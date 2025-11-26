import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("HoneyTraceStorageModule", (m) => {
    const honeyTraceStorage = m.contract("HoneyTraceStorage", ["0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0"]);

    return { honeyTraceStorage };
});