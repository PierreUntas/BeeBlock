import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("HoneyTraceStorageModule", (m) => {
    const honeyTraceStorage = m.contract("HoneyTraceStorage", ["0x5FbDB2315678afecb367f032d93F642f64180aa3"]);

    return { honeyTraceStorage };
});