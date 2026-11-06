#!/bin/sh
set -e

echo "Starting local Hardhat node in the background..."
npx hardhat node --hostname 0.0.0.0 &
NODE_PID=$!

echo "Waiting for Hardhat node RPC to be available at http://127.0.0.1:8545..."
until nc -z 127.0.0.1 8545; do
  sleep 1
done

echo "Hardhat RPC is ready! Compiling and deploying EvidenceChainOfCustody..."
npx hardhat run scripts/deploy.js --network localhost

echo "Blockchain service initialized. Exported deployment info."

# Wait for node process to keep container alive
wait $NODE_PID
