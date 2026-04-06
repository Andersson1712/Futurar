import { useCallback, useEffect, useRef, useState } from 'react';

interface HIDDeviceInfo {
    vendorId: number;
    productId: number;
    productName: string;
}

interface UseInputDeviceOptions {
    onActivate: () => void;
    enabled?: boolean;
    keys?: string[]; // Teclas que activan (default: Space, Enter)
}

interface UseInputDeviceReturn {
    // Estado
    isHIDSupported: boolean;
    connectedDevice: HIDDeviceInfo | null;
    isConnecting: boolean;

    // Acciones
    connectHIDDevice: () => Promise<void>;
    disconnectHIDDevice: () => void;
}

/**
 * Hook para manejar múltiples métodos de entrada:
 * 1. Eventos de teclado (Space, Enter, o teclas personalizadas)
 * 2. Eventos de clic
 * 3. WebHID API para dispositivos USB especiales (pulsadores)
 */
export const useInputDevice = ({
    onActivate,
    enabled = true,
    keys = ['Space', 'Enter']
}: UseInputDeviceOptions): UseInputDeviceReturn => {
    const [isHIDSupported] = useState(() => 'hid' in navigator);
    const [connectedDevice, setConnectedDevice] = useState<HIDDeviceInfo | null>(null);
    const [isConnecting, setIsConnecting] = useState(false);

    const hidDeviceRef = useRef<HIDDevice | null>(null);
    const onActivateRef = useRef(onActivate);

    // Mantener referencia actualizada del callback
    useEffect(() => {
        onActivateRef.current = onActivate;
    }, [onActivate]);

    // Manejar eventos de teclado
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!enabled) return;
        if (keys.includes(e.code)) {
            e.preventDefault();
            onActivateRef.current();
        }
    }, [enabled, keys]);

    // Manejar eventos de clic
    const handleClick = useCallback((e: MouseEvent) => {
        if (!enabled) return;
        // Solo activar si el clic no es en un elemento interactivo específico
        const target = e.target as HTMLElement;
        if (target.closest('input, textarea, select, [data-no-scan]')) {
            return;
        }
        onActivateRef.current();
    }, [enabled]);

    // Manejar eventos del dispositivo HID
    const handleHIDInput = useCallback((event: HIDInputReportEvent) => {
        if (!enabled) return;

        // Los dispositivos HID envían datos en event.data
        // Cualquier entrada del dispositivo activa la selección
        const data = event.data;

        // Verificar si hay algún byte activo (botón presionado)
        for (let i = 0; i < data.byteLength; i++) {
            if (data.getUint8(i) > 0) {
                onActivateRef.current();
                break;
            }
        }
    }, [enabled]);

    // Conectar dispositivo HID
    const connectHIDDevice = useCallback(async () => {
        if (!isHIDSupported) {
            console.warn('WebHID API no está disponible en este navegador');
            return;
        }

        setIsConnecting(true);

        try {
            // Solicitar acceso a cualquier dispositivo HID
            const devices = await navigator.hid.requestDevice({
                filters: [] // Sin filtros para permitir cualquier dispositivo
            });

            if (devices.length === 0) {
                console.log('No se seleccionó ningún dispositivo');
                return;
            }

            const device = devices[0];

            // Abrir conexión con el dispositivo
            if (!device.opened) {
                await device.open();
            }

            // Guardar referencia y configurar listener
            hidDeviceRef.current = device;
            device.addEventListener('inputreport', handleHIDInput);

            setConnectedDevice({
                vendorId: device.vendorId,
                productId: device.productId,
                productName: device.productName || 'Dispositivo desconocido'
            });

            console.log('Dispositivo HID conectado:', device.productName);

        } catch (error) {
            console.error('Error al conectar dispositivo HID:', error);
        } finally {
            setIsConnecting(false);
        }
    }, [isHIDSupported, handleHIDInput]);

    // Desconectar dispositivo HID
    const disconnectHIDDevice = useCallback(() => {
        if (hidDeviceRef.current) {
            hidDeviceRef.current.removeEventListener('inputreport', handleHIDInput);
            hidDeviceRef.current.close();
            hidDeviceRef.current = null;
            setConnectedDevice(null);
            console.log('Dispositivo HID desconectado');
        }
    }, [handleHIDInput]);

    // Configurar listeners de teclado y clic
    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('click', handleClick);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('click', handleClick);
        };
    }, [enabled, handleKeyDown, handleClick]);

    // Intentar reconectar dispositivos HID previamente conectados
    useEffect(() => {
        if (!isHIDSupported) return;

        const reconnectDevices = async () => {
            try {
                const devices = await navigator.hid.getDevices();
                if (devices.length > 0) {
                    const device = devices[0];
                    if (!device.opened) {
                        await device.open();
                    }
                    hidDeviceRef.current = device;
                    device.addEventListener('inputreport', handleHIDInput);
                    setConnectedDevice({
                        vendorId: device.vendorId,
                        productId: device.productId,
                        productName: device.productName || 'Dispositivo desconocido'
                    });
                }
            } catch (error) {
                console.error('Error al reconectar dispositivos HID:', error);
            }
        };

        reconnectDevices();

        return () => {
            disconnectHIDDevice();
        };
    }, [isHIDSupported, handleHIDInput, disconnectHIDDevice]);

    return {
        isHIDSupported,
        connectedDevice,
        isConnecting,
        connectHIDDevice,
        disconnectHIDDevice
    };
};

export default useInputDevice;
