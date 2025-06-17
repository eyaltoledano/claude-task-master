import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Script to test OpenRouter API key validity

async function testOpenRouterKey() {
    // Get the API key from environment variables
    const apiKey = process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
        console.error('Error: OPENROUTER_API_KEY not found in .env file');
        return false;
    }
    
    console.log('Testing OpenRouter API key...');
    
    try {
        // Make a request to OpenRouter API to check if the key is valid
        const response = await axios.get('https://openrouter.ai/api/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.status === 200) {
            console.log('✅ Success: OpenRouter API key is valid');
            console.log(`Available models: ${response.data.data.length}`);
            return true;
        } else {
            console.error('❌ Error: Unexpected response from OpenRouter API');
            console.error('Status:', response.status);
            return false;
        }
    } catch (error) {
        console.error('❌ Error: Invalid OpenRouter API key');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Message:', error.response.data.error?.message || 'Unknown error');
        } else {
            console.error(error.message);
        }
        return false;
    }
}

// Run the test
testOpenRouterKey()
    .then(isValid => {
        if (!isValid) {
            console.log('Please check your OpenRouter API key in the .env file');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });