import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("HoneyTraceStorageModule", (m) => {
    const honeyTraceStorage = m.contract("HoneyTraceStorage", ["0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9"]);

    return { honeyTraceStorage };
});