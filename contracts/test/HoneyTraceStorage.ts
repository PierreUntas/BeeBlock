import {expect} from "chai";
import {network} from "hardhat";

const {ethers} = await network.connect();

describe("HoneyTraceStorage", function () {
    let owner: any;
    let admin: any;
    let produce: any;
    let customer: any;
    let honeyTraceStorage: any;
    let honeyTokenization: any;

    async function deployHoneyTraceStorage() {
        const [owner, admin, produce, customer] = await ethers.getSigners();
        const HoneyTokenization = await ethers.getContractFactory("HoneyTokenization");
        const honeyTokenization = await HoneyTokenization.deploy("");
        const honeyTokenizationAddress = honeyTokenization.getAddress();
        const honeyTraceStorage = await ethers.deployContract("HoneyTraceStorage", [honeyTokenizationAddress]);
        return {owner, admin, produce, customer, honeyTraceStorage, honeyTokenization};
    }

    beforeEach(async function () {
       const deployment = await deployHoneyTraceStorage();
       owner = deployment.owner;
       admin = deployment.admin;
       produce = deployment.produce;
       customer = deployment.customer;
       honeyTraceStorage = deployment.honeyTraceStorage;
       honeyTokenization = deployment.honeyTokenization;
    })

    describe("Deployment", function () {
        it("Should deploy the HoneyTraceStorage contract", async function () {
            expect(await honeyTokenization.owner()).to.equal(await owner.getAddress());
        })
    })
});