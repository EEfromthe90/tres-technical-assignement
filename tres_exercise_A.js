import fetch from 'node-fetch';
import { writeFileSync } from 'fs';
import path from 'path';

const start = "2025-02-10";
const csvFileName = "staking_rewards.csv"
const grapQLEndpoint = "https://api.prod.tres.finance/graphql";
const clientId = "DMVBrTzb5nlrnuwqUswUsn2YsVBZLG9w";
const clientSecret = "G6LctpdNNV7K4kyYo7g53Mo2-8vgcgDXajVUt5-xol-EEmbp1-kv_dUjcCp6QtMn";

// Authentication 
async function getAccessToken(clientId, clientSecret) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; //  disable SSL verify
        const response = await fetch(grapQLEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `mutation LoginMutation($clientId: String!, $clientSecret: String!) 
                { getApiKey(clientId: $clientId, clientSecret: $clientSecret) { token } }`,
                variables: { clientId, clientSecret }
            })
        });

    const data = await response.json();
    const accessToken = data?.data?.getApiKey?.token?.access_token;
    return accessToken;
}

// Get staking options
const fetchGraphQL = async (query, variables, token) => {
    const response = await fetch(grapQLEndpoint, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables })
    });
    return response.json();
};

// Format tags
function formatTags(tags) {
    return tags?.length ? tags.join(';') : '[]';
}

const main = async () => {
    // Get API key
    const apiKey = await getAccessToken(clientId, clientSecret);
    console.log("Access Token:", apiKey);

    // Get staking options
    console.log("Fetching staking options...");
    const stakingOptions = await fetchGraphQL(`
        query { stakingYieldOptions(resolveStatus: true) {
            platform
            assetOptions {
                asset { identifier }
                internalAccountOptions {
                    internalAccount { name id identifier }
                    earliest latest
                }
            }
        }}  
    `, {}, apiKey);

    const rewards = [];
    let processedAccounts = 0;
    // Iterate
    for (const platform of stakingOptions.data.stakingYieldOptions) {
        for (const asset of platform.assetOptions) {
            for (const account of asset.internalAccountOptions) {
                // Get staking data account
                const { identifier } = account.internalAccount;
                if (!identifier || !account.earliest || !account.latest) continue;
                console.log(`Processing account: ${identifier} on platform: ${platform.platform}`);
                const stakingDataResponse = await fetchGraphQL(`
                    query ($platform: Platform!, $identifier: String!) {
                        stakingData(platform: $platform, identifier: $identifier, start: "${start}", end: "${account.latest}", yieldType: REWARD) {
                            assetIdentifier internalAccountName internalAccountTags
                            data { byValidator { start generatedRewards locked claimable validatorIdentifier } }
                        }
                    }`, 
                    { platform: platform.platform, identifier }, apiKey);
                const stakingData = stakingDataResponse.data?.stakingData;
                if (!stakingData?.data?.byValidator) continue;

                // Save to CSV
                rewards.push(...stakingData.data.byValidator.map(v => [
                    v.start, v.generatedRewards || 0, v.locked || '', v.claimable || '',
                    identifier, "REWARD", v.validatorIdentifier || '',
                    stakingData.assetIdentifier || 'native',
                    stakingData.internalAccountName,
                    formatTags(stakingData.internalAccountTags),
                    platform.platform
                ].join(',')));
                processedAccounts++;
            }
        }
    }

    console.log(`Processed ${processedAccounts} accounts`);
    const filepath = path.resolve(csvFileName);
    writeFileSync(filepath, 
        "Start,Generated rewards,Locked,Claimable,Identifier,Yield type,Validator identifier,Asset identifier,Internal account name,Internal account tags,Platform\n" +
        rewards.join('\n')
    );
    console.log(`CSV created at: ${filepath}`);
};

main();
