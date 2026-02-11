/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}

// WebHID Types
interface HIDDevice {
    opened: boolean;
    vendorId: number;
    productId: number;
    productName: string;
    collections: HIDCollectionInfo[];
    oninputreport: ((event: HIDInputReportEvent) => void) | null;
    open(): Promise<void>;
    close(): Promise<void>;
    sendReport(reportId: number, data: BufferSource): Promise<void>;
    sendFeatureReport(reportId: number, data: BufferSource): Promise<void>;
    receiveFeatureReport(reportId: number): Promise<DataView>;
    addEventListener(type: string, listener: EventListener): void;
    removeEventListener(type: string, listener: EventListener): void;
}

interface HIDCollectionInfo {
    usagePage: number;
    usage: number;
    type: number;
    children: HIDCollectionInfo[];
    inputReports: HIDReportInfo[];
    outputReports: HIDReportInfo[];
    featureReports: HIDReportInfo[];
}

interface HIDReportInfo {
    reportId: number;
    items: HIDReportItem[];
}

interface HIDReportItem {
    isAbsolute: boolean;
    isArray: boolean;
    isBufferedBytes: boolean;
    isConstant: boolean;
    isLinear: boolean;
    isRange: boolean;
    isVolatile: boolean;
    hasNull: boolean;
    hasPreferredState: boolean;
    wrap: boolean;
    usages: number[];
    usageMinimum: number;
    usageMaximum: number;
    reportSize: number;
    reportCount: number;
    unitExponent: number;
    unitSystem: string;
    unitFactorLengthExponent: number;
    unitFactorMassExponent: number;
    unitFactorTimeExponent: number;
    unitFactorTemperatureExponent: number;
    unitFactorCurrentExponent: number;
    unitFactorLuminousIntensityExponent: number;
    logicalMinimum: number;
    logicalMaximum: number;
    physicalMinimum: number;
    physicalMaximum: number;
    strings: string[];
}

interface HIDInputReportEvent extends Event {
    device: HIDDevice;
    reportId: number;
    data: DataView;
}

interface HID extends EventTarget {
    getDevices(): Promise<HIDDevice[]>;
    requestDevice(options: HIDDeviceRequestOptions): Promise<HIDDevice[]>;
}

interface HIDDeviceRequestOptions {
    filters: HIDDeviceFilter[];
}

interface HIDDeviceFilter {
    vendorId?: number;
    productId?: number;
    usagePage?: number;
    usage?: number;
}

interface Navigator {
    hid: HID;
}
