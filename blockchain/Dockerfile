FROM node:20-alpine

WORKDIR /app

# Install netcat for port checking
RUN apk add --no-cache netcat-openbsd

COPY package.json ./
RUN npm install

COPY hardhat.config.js ./
COPY contracts/ ./contracts/
COPY scripts/ ./scripts/
COPY test/ ./test/
COPY entrypoint.sh ./

RUN chmod +x entrypoint.sh
RUN npx hardhat compile

EXPOSE 8545

ENTRYPOINT ["./entrypoint.sh"]
