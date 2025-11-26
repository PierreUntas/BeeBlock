import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("HoneyTokenizationModule", (m) => {
    const honeyTokenization = m.contract("HoneyTokenization", [""]);

    return { honeyTokenization };
});
