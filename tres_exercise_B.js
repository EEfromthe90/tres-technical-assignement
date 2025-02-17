import { Connection, PublicKey } from "@solana/web3.js";
import fs from 'fs';

const connection = new Connection("https://api.mainnet-beta.solana.com");

(async () => {
    const getWithdrawAuthority = async (address) => {
        const info = await connection.getParsedAccountInfo(new PublicKey(address));
        const data = info?.value?.data?.parsed?.info;
        const withdrawAuthority = data?.authorized?.withdrawer || data?.authorizedWithdrawer || data?.meta?.authorized?.withdrawer || address;
        console.log(`${address} -> ${withdrawAuthority}`);
    };
    const addresses = fs.readFileSync('addresses.txt', 'utf-8').split('\n').map(line => line.trim());
    for (const address of addresses) await getWithdrawAuthority(address);
})();
