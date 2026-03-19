import { SportsDataService } from './src/services/SportsDataService.js';

async function test() {
  try {
    console.log('Testing SportsDataService...');
    const data = await SportsDataService.getSportsData();
    console.log('Result:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
