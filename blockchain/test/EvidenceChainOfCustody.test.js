const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EvidenceChainOfCustody Contract", function () {
  let EvidenceChainOfCustody;
  let contract;
  let owner, collector, investigator, analyst, court, stranger;

  const sampleEvidenceId = "EVD-2026-0001";
  const sampleHash = ethers.keccak256(ethers.toUtf8Bytes("evidence_raw_bytes_test_content"));
  const sampleHash2 = ethers.keccak256(ethers.toUtf8Bytes("modified_content_hash"));

  beforeEach(async function () {
    [owner, collector, investigator, analyst, court, stranger] = await ethers.getSigners();
    EvidenceChainOfCustody = await ethers.getContractFactory("EvidenceChainOfCustody");
    contract = await EvidenceChainOfCustody.deploy();
    await contract.waitForDeployment();
  });

  describe("Deployment & Configuration", function () {
    it("sets the deployer as owner and default authorized relayer", async function () {
      expect(await contract.owner()).to.equal(owner.address);
      expect(await contract.authorizedRelayers(owner.address)).to.be.true;
    });

    it("allows owner to configure authorized relayers", async function () {
      await expect(contract.connect(owner).setRelayer(analyst.address, true))
        .to.emit(contract, "RelayerStatusUpdated")
        .withArgs(analyst.address, true);

      expect(await contract.authorizedRelayers(analyst.address)).to.be.true;

      await contract.connect(owner).setRelayer(analyst.address, false);
      expect(await contract.authorizedRelayers(analyst.address)).to.be.false;
    });

    it("rejects non-owner setting relayers", async function () {
      await expect(
        contract.connect(stranger).setRelayer(stranger.address, true)
      ).to.be.revertedWithCustomError(contract, "Unauthorized");
    });
  });

  describe("Evidence Registration", function () {
    it("successfully registers evidence and emits EvidenceRegistered", async function () {
      const tx = await contract.connect(collector).registerEvidence(
        sampleEvidenceId,
        sampleHash,
        collector.address
      );

      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(contract, "EvidenceRegistered")
        .withArgs(sampleEvidenceId, sampleEvidenceId, sampleHash, collector.address, block.timestamp);

      const record = await contract.getEvidence(sampleEvidenceId);
      expect(record.fileHash).to.equal(sampleHash);
      expect(record.initialCustodian).to.equal(collector.address);
      expect(record.currentCustodian).to.equal(collector.address);
      expect(record.exists).to.be.true;
      expect(record.registrationTimestamp).to.equal(block.timestamp);
    });

    it("rejects duplicate evidence ID", async function () {
      await contract.registerEvidence(sampleEvidenceId, sampleHash, collector.address);

      await expect(
        contract.registerEvidence(sampleEvidenceId, sampleHash, collector.address)
      ).to.be.revertedWithCustomError(contract, "EvidenceAlreadyExists").withArgs(sampleEvidenceId);
    });

    it("rejects empty evidence ID", async function () {
      await expect(
        contract.registerEvidence("", sampleHash, collector.address)
      ).to.be.revertedWithCustomError(contract, "EmptyEvidenceId");
    });

    it("rejects zero file hash", async function () {
      await expect(
        contract.registerEvidence(sampleEvidenceId, ethers.ZeroHash, collector.address)
      ).to.be.revertedWithCustomError(contract, "InvalidFileHash");
    });

    it("rejects zero address as initial custodian", async function () {
      await expect(
        contract.registerEvidence(sampleEvidenceId, sampleHash, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(contract, "InvalidCustodianAddress");
    });

    it("ensures original hash cannot be overwritten", async function () {
      await contract.registerEvidence(sampleEvidenceId, sampleHash, collector.address);

      // Attempt to register again with different hash
      await expect(
        contract.registerEvidence(sampleEvidenceId, sampleHash2, collector.address)
      ).to.be.revertedWithCustomError(contract, "EvidenceAlreadyExists");

      // Verify original hash remains unchanged
      const record = await contract.getEvidence(sampleEvidenceId);
      expect(record.fileHash).to.equal(sampleHash);
    });
  });

  describe("Custody Transfer", function () {
    beforeEach(async function () {
      await contract.connect(collector).registerEvidence(
        sampleEvidenceId,
        sampleHash,
        collector.address
      );
    });

    it("allows current custodian to transfer custody and emits CustodyTransferred", async function () {
      const reason = "Transferring to investigator for forensic intake";
      const tx = await contract.connect(collector).transferCustody(
        sampleEvidenceId,
        investigator.address,
        reason
      );

      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(contract, "CustodyTransferred")
        .withArgs(
          sampleEvidenceId,
          sampleEvidenceId,
          collector.address,
          investigator.address,
          block.timestamp,
          reason
        );

      const record = await contract.getEvidence(sampleEvidenceId);
      expect(record.currentCustodian).to.equal(investigator.address);
      expect(record.initialCustodian).to.equal(collector.address);
      expect(await contract.isCurrentCustodian(sampleEvidenceId, investigator.address)).to.be.true;
      expect(await contract.isCurrentCustodian(sampleEvidenceId, collector.address)).to.be.false;
    });

    it("rejects transfer from non-custodian and non-relayer", async function () {
      await expect(
        contract.connect(stranger).transferCustody(
          sampleEvidenceId,
          investigator.address,
          "Unauthorized transfer attempt"
        )
      ).to.be.revertedWithCustomError(contract, "NotCurrentCustodian");
    });

    it("allows authorized relayer to transfer custody on behalf of custodian", async function () {
      // owner is authorized relayer by default
      const reason = "Backend relayed transfer with verified credentials";
      await expect(
        contract.connect(owner).transferCustody(
          sampleEvidenceId,
          investigator.address,
          reason
        )
      ).to.emit(contract, "CustodyTransferred");

      const record = await contract.getEvidence(sampleEvidenceId);
      expect(record.currentCustodian).to.equal(investigator.address);
    });

    it("allows transferCustodyByRelayer with explicit custodian verification", async function () {
      await expect(
        contract.connect(owner).transferCustodyByRelayer(
          sampleEvidenceId,
          collector.address,
          investigator.address,
          "Verified relayer intake"
        )
      ).to.emit(contract, "CustodyTransferred");

      // Attempting again with stale expected custodian fails
      await expect(
        contract.connect(owner).transferCustodyByRelayer(
          sampleEvidenceId,
          collector.address,
          analyst.address,
          "Second transfer attempt"
        )
      ).to.be.revertedWithCustomError(contract, "NotCurrentCustodian");
    });

    it("rejects transfer to zero address", async function () {
      await expect(
        contract.connect(collector).transferCustody(
          sampleEvidenceId,
          ethers.ZeroAddress,
          "Invalid recipient"
        )
      ).to.be.revertedWithCustomError(contract, "InvalidCustodianAddress");
    });

    it("rejects transfer to the same current custodian", async function () {
      await expect(
        contract.connect(collector).transferCustody(
          sampleEvidenceId,
          collector.address,
          "No change transfer"
        )
      ).to.be.revertedWithCustomError(contract, "CustodianCannotBeSame");
    });

    it("rejects empty reason string", async function () {
      await expect(
        contract.connect(collector).transferCustody(
          sampleEvidenceId,
          investigator.address,
          ""
        )
      ).to.be.revertedWithCustomError(contract, "EmptyTransferReason");
    });

    it("rejects transfer on non-existent evidence", async function () {
      await expect(
        contract.connect(collector).transferCustody(
          "DOES-NOT-EXIST",
          investigator.address,
          "Testing non-existent"
        )
      ).to.be.revertedWithCustomError(contract, "EvidenceNotFound");
    });
  });

  describe("Custody History & Chronology", function () {
    it("maintains an accurate chronological custody transfer log", async function () {
      await contract.connect(collector).registerEvidence(
        sampleEvidenceId,
        sampleHash,
        collector.address
      );

      // Transfer 1: Collector -> Investigator
      await contract.connect(collector).transferCustody(
        sampleEvidenceId,
        investigator.address,
        "Transferred to Investigator for analysis intake"
      );

      // Transfer 2: Investigator -> Analyst
      await contract.connect(investigator).transferCustody(
        sampleEvidenceId,
        analyst.address,
        "Transferred to Forensic Analyst for digital extraction"
      );

      // Transfer 3: Analyst -> Court
      await contract.connect(analyst).transferCustody(
        sampleEvidenceId,
        court.address,
        "Delivered to Court for presentation"
      );

      const history = await contract.getCustodyHistory(sampleEvidenceId);
      expect(history.length).to.equal(4); // 1 initial registration + 3 transfers

      expect(history[0].previousCustodian).to.equal(ethers.ZeroAddress);
      expect(history[0].newCustodian).to.equal(collector.address);
      expect(history[0].reason).to.equal("Initial registration");

      expect(history[1].previousCustodian).to.equal(collector.address);
      expect(history[1].newCustodian).to.equal(investigator.address);
      expect(history[1].reason).to.equal("Transferred to Investigator for analysis intake");

      expect(history[2].previousCustodian).to.equal(investigator.address);
      expect(history[2].newCustodian).to.equal(analyst.address);
      expect(history[2].reason).to.equal("Transferred to Forensic Analyst for digital extraction");

      expect(history[3].previousCustodian).to.equal(analyst.address);
      expect(history[3].newCustodian).to.equal(court.address);
      expect(history[3].reason).to.equal("Delivered to Court for presentation");

      // Verify timestamps are non-decreasing
      for (let i = 1; i < history.length; i++) {
        expect(history[i].timestamp).to.be.gte(history[i - 1].timestamp);
      }
    });
  });

  describe("Integrity Verification Functionality", function () {
    beforeEach(async function () {
      await contract.connect(collector).registerEvidence(
        sampleEvidenceId,
        sampleHash,
        collector.address
      );
    });

    it("confirms true when supplied hash matches original registered hash", async function () {
      const [matches, originalHash] = await contract.verifyEvidenceRecord(
        sampleEvidenceId,
        sampleHash
      );
      expect(matches).to.be.true;
      expect(originalHash).to.equal(sampleHash);
    });

    it("confirms false when supplied hash does not match original registered hash", async function () {
      const [matches, originalHash] = await contract.verifyEvidenceRecord(
        sampleEvidenceId,
        sampleHash2
      );
      expect(matches).to.be.false;
      expect(originalHash).to.equal(sampleHash);
    });

    it("reverts verification query for non-existent evidence", async function () {
      await expect(
        contract.verifyEvidenceRecord("NON_EXISTENT", sampleHash)
      ).to.be.revertedWithCustomError(contract, "EvidenceNotFound");
    });
  });
});
