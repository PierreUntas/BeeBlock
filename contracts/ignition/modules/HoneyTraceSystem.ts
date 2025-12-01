import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("HoneyTraceSystemModule", (m) => {
    const honeyTokenization = m.contract("HoneyTokenization", [""]);

    const honeyTraceStorage = m.contract("HoneyTraceStorage", [honeyTokenization]);

    m.call(honeyTokenization, "transferOwnership", [honeyTraceStorage]);

    return { honeyTokenization, honeyTraceStorage };
});