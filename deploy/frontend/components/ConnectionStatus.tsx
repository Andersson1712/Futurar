import React, { useState } from 'react';
import { useInputDevice } from '../hooks/useInputDevice';

interface ConnectionStatusProps {
    onConnectHID?: () => void;
}

const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ onConnectHID }) => {
    const [showDetails, setShowDetails] = useState(false);

    const {
        isHIDSupported,
        connectedDevice,
        isConnecting,
        connectHIDDevice
    } = useInputDevice({
        onActivate: () => { },
        enabled: false // Solo para mostrar estado, no para activar
    });

    const handleConnect = async () => {
        await connectHIDDevice();
        onConnectHID?.();
    };

    return (
        <div className="bg-surface-dark/50 rounded-2xl p-6 border border-border-accent">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">usb</span>
                Dispositivo de Entrada
            </h3>

            {/* Estado del dispositivo */}
            <div className="space-y-3">
                {/* Soporte WebHID */}
                <div className="flex items-center justify-between">
                    <span className="text-gray-400">WebHID API</span>
                    <span className={`flex items-center gap-1 ${isHIDSupported ? 'text-green-400' : 'text-yellow-400'}`}>
                        <span className="material-symbols-outlined text-sm">
                            {isHIDSupported ? 'check_circle' : 'warning'}
                        </span>
                        {isHIDSupported ? 'Disponible' : 'No disponible'}
                    </span>
                </div>

                {/* Dispositivo conectado */}
                <div className="flex items-center justify-between">
                    <span className="text-gray-400">Pulsador USB</span>
                    {connectedDevice ? (
                        <span className="flex items-center gap-1 text-green-400">
                            <span className="material-symbols-outlined text-sm animate-pulse">sensors</span>
                            {connectedDevice.productName}
                        </span>
                    ) : (
                        <span className="text-gray-500">No conectado</span>
                    )}
                </div>

                {/* Botón de conexión */}
                {isHIDSupported && !connectedDevice && (
                    <button
                        onClick={handleConnect}
                        disabled={isConnecting}
                        className="w-full mt-4 px-6 py-3 bg-primary/20 hover:bg-primary/30 text-primary rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isConnecting ? (
                            <>
                                <span className="material-symbols-outlined animate-spin">progress_activity</span>
                                Conectando...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined">usb</span>
                                Conectar Pulsador USB
                            </>
                        )}
                    </button>
                )}

                {/* Métodos alternativos */}
                <div className="mt-4 pt-4 border-t border-white/10">
                    <p className="text-sm text-gray-500 mb-2">Métodos de entrada activos:</p>
                    <div className="flex flex-wrap gap-2">
                        <span className="px-3 py-1 bg-white/5 rounded-full text-xs text-gray-400">
                            <kbd>Espacio</kbd>
                        </span>
                        <span className="px-3 py-1 bg-white/5 rounded-full text-xs text-gray-400">
                            <kbd>Enter</kbd>
                        </span>
                        <span className="px-3 py-1 bg-white/5 rounded-full text-xs text-gray-400">
                            Clic
                        </span>
                        {connectedDevice && (
                            <span className="px-3 py-1 bg-green-500/20 rounded-full text-xs text-green-400">
                                USB HID
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Información adicional */}
            <button
                onClick={() => setShowDetails(!showDetails)}
                className="mt-4 text-sm text-gray-500 hover:text-gray-400 flex items-center gap-1"
            >
                <span className="material-symbols-outlined text-sm">
                    {showDetails ? 'expand_less' : 'expand_more'}
                </span>
                {showDetails ? 'Ocultar detalles' : 'Más información'}
            </button>

            {showDetails && (
                <div className="mt-3 p-4 bg-black/20 rounded-xl text-sm text-gray-400 space-y-2">
                    <p>
                        <strong>Pulsadores compatibles:</strong> Cualquier dispositivo USB que envíe señales HID
                        (switches, botones de accesibilidad, adaptadores de pulsador).
                    </p>
                    <p>
                        <strong>Navegadores soportados:</strong> Chrome 89+, Edge 89+, Opera 75+
                    </p>
                    <p>
                        <strong>Nota:</strong> Firefox y Safari no soportan WebHID, pero los pulsadores que
                        emulan teclado funcionarán normalmente.
                    </p>
                </div>
            )}
        </div>
    );
};

export default ConnectionStatus;
