import {expect} from "chai";
import {network} from "hardhat";

const {ethers} = await network.connect();

describe("HoneyTraceStorage", function () {

    async function deployHoneyTraceStorage() {
        const [owner, admin, produce, customer] = await ethers.getSigners();

        const HoneyTokenization = await ethers.getContractFactory("HoneyTokenization");
        const honeyTokenization = await HoneyTokenization.deploy("");
        const honeyTokenizationAddress = honeyTokenization.getAddress();

        const HoneyTraceStorage = await ethers.getContractFactory("HoneyTraceStorage");
        const honeyTraceStorage = await HoneyTraceStorage.deploy(honeyTokenizationAddress);

        return {owner, admin, produce, customer, honeyTraceStorage, honeyTokenization};
    }

    describe("Deployment", function () {
        it("Should deploy the HoneyTraceStorage contract", async function () {
            const {owner, honeyTokenization} = await deployHoneyTraceStorage();
            expect(await honeyTokenization.owner()).to.equal(await owner.getAddress());
        })
    })
});