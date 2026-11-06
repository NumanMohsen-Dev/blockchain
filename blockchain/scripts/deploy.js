const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Starting EvidenceChainOfCustody deployment...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contract with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", hre.ethers.formatEther(balance), "ETH");

  const EvidenceChainOfCustody = await hre.ethers.getContractFactory("EvidenceChainOfCustody");
  const contract = await EvidenceChainOfCustody.deploy();

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log("EvidenceChainOfCustody deployed successfully to:", contractAddress);

  // Extract artifact to get full ABI
  const artifact = await hre.artifacts.readArtifact("EvidenceChainOfCustody");

  const deploymentInfo = {
    address: contractAddress,
    deployer: deployer.address,
    network: hre.network.name,
    chainId: hre.network.config.chainId || 31337,
    deployedAt: new Date().toISOString(),
    abi: artifact.abi,
  };

  // Target paths for export
  const exportDirs = [
    path.join(__dirname, "..", "deployments"),
    path.join(__dirname, "..", "..", "backend", "app", "blockchain"),
  ];

  for (const dir of exportDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const targetFile = path.join(dir, "contract_info.json");
    fs.writeFileSync(targetFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`Saved deployment info to: ${targetFile}`);
  }

  return deploymentInfo;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Deployment failed:", error);
      process.exit(1);
    });
}

module.exports = main;
