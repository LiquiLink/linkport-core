const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CCIPMsgBridge", function () {
    let CCIPMsgBridge;
    let ccipMsgBridge;
    let owner;
    let addr1;
    let addr2;

    beforeEach(async function () {
        CCIPMsgBridge = await ethers.getContractFactory("CCIPMsgBridge");
        [owner, addr1, addr2] = await ethers.getSigners();
        ccipMsgBridge = await CCIPMsgBridge.deploy();
        await ccipMsgBridge.deployed();
    });

    describe("Cross-chain messaging", function () {
        it("Should send a message to another chain", async function () {
            const message = "Hello from Ethereum!";
            const targetChain = "BSC";

            await ccipMsgBridge.sendMessage(targetChain, message);

            const receivedMessage = await ccipMsgBridge.getMessage(targetChain);
            expect(receivedMessage).to.equal(message);
        });

        it("Should receive a message from another chain", async function () {
            const message = "Hello from BSC!";
            const sourceChain = "BSC";

            await ccipMsgBridge.receiveMessage(sourceChain, message);

            const receivedMessage = await ccipMsgBridge.getMessage(sourceChain);
            expect(receivedMessage).to.equal(message);
        });
    });

    describe("Access control", function () {
        it("Should only allow the owner to send messages", async function () {
            const message = "Unauthorized message";
            const targetChain = "BSC";

            await expect(ccipMsgBridge.connect(addr1).sendMessage(targetChain, message)).to.be.revertedWith("Ownable: caller is not the owner");
        });
    });
});