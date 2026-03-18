import { RawScrapedEvent, EnrichedEvent, Location } from '../types/schema.js';
import { createHash } from 'crypto';

const DEFAULT_SEATTLE_COORDS: Location = {
  name: 'Seattle, WA',
  lat: 47.6062,
  lon: -122.3321,
};

// Date validation - returns a valid date or null
function isValidDateString(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  
  // Check if already in ISO format
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1]);
    const month = parseInt(isoMatch[2]);
    const day = parseInt(isoMatch[3]);
    
    // Basic sanity checks
    if (year < 2025 || year > 2027) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    
    return true;
  }
  
  return false;
}

// Fix invalid dates - returns a valid ISO date string
function fixDateString(dateStr: string | undefined, fallback: string = '2026-03-15'): string {
  if (!dateStr) return fallback;
  
  // If already valid, return as-is
  if (isValidDateString(dateStr)) {
    return dateStr.substring(0, 10);
  }
  
  // Try to extract YYYY-MM-DD from various formats
  const yyyyMmDd = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (yyyyMmDd) {
    const year = parseInt(yyyyMmDd[1]);
    const month = parseInt(yyyyMmDd[2]);
    const day = parseInt(yyyyMmDd[3]);
    
    if (year >= 2025 && year <= 2027 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  
  // Return fallback
  return fallback;
}

const KNOWN_VENUES: Record<string, Location> = {
  // ============================================
  // SEATTLE THEATERS & CONCERT VENUES (Exact Addresses)
  // ============================================
  // Downtown Seattle
  '5th avenue theatre': { name: 'The 5th Avenue Theatre', address: '1308 5th Ave, Seattle, WA 98101', lat: 47.6118, lon: -122.3286 },
  '5th avenue': { name: 'The 5th Avenue Theatre', address: '1308 5th Ave, Seattle, WA 98101', lat: 47.6118, lon: -122.3286 },
  'paramount theatre': { name: 'Paramount Theatre', address: '911 Pine St, Seattle, WA 98101', lat: 47.6129, lon: -122.3320 },
  'the paramount': { name: 'Paramount Theatre', address: '911 Pine St, Seattle, WA 98101', lat: 47.6129, lon: -122.3320 },
  'moore theatre': { name: 'The Moore Theatre', address: '1932 2nd Ave, Seattle, WA 98101', lat: 47.6147, lon: -122.3421 },
  'the moore': { name: 'The Moore Theatre', address: '1932 2nd Ave, Seattle, WA 98101', lat: 47.6147, lon: -122.3421 },
  'showbox': { name: 'The Showbox', address: '1426 1st Ave, Seattle, WA 98101', lat: 47.6122, lon: -122.3267 },
  'the showbox': { name: 'The Showbox', address: '1426 1st Ave, Seattle, WA 98101', lat: 47.6122, lon: -122.3267 },
  'showbox sodo': { name: 'Showbox SoDo', address: '1700 1st Ave S, Seattle, WA 98134', lat: 47.5810, lon: -122.3350 },
  'the showbox sodo': { name: 'Showbox SoDo', address: '1700 1st Ave S, Seattle, WA 98134', lat: 47.5810, lon: -122.3350 },
  'benaroya hall': { name: 'Benaroya Hall', address: '200 University St, Seattle, WA 98101', lat: 47.6247, lon: -122.3320 },
  
  // Capitol Hill
  'neumos': { name: 'Neumos', address: '925 E Pike St, Seattle, WA 98122', lat: 47.6147, lon: -122.3193 },
  'the crocodile': { name: 'The Crocodile', address: '2200 2nd Ave, Seattle, WA 98121', lat: 47.6148, lon: -122.3217 },
  'crocodile': { name: 'The Crocodile', address: '2200 2nd Ave, Seattle, WA 98121', lat: 47.6148, lon: -122.3217 },
  'barboza': { name: 'Barboza', address: '925 E Pike St, Seattle, WA 98122', lat: 47.6147, lon: -122.3193 },
  'timbre room': { name: 'Timbre Room', address: '1809 10th Ave, Seattle, WA 98122', lat: 47.6162, lon: -122.3161 },
  'chop suey': { name: 'Chop Suey', address: '1325 E Madison St, Seattle, WA 98122', lat: 47.6145, lon: -122.3167 },
  'q nightclub': { name: 'Q Nightclub', address: '1422 Post Alley, Seattle, WA 98101', lat: 47.6133, lon: -122.3410 },
  
  // UW Area
  'husky stadium': { name: 'Husky Stadium', address: '3800 Montlake Blvd NE, Seattle, WA 98195', lat: 47.6505, lon: -122.3318 },
  'husky ballpark': { name: 'Husky Ballpark', address: '2819 Walla Walla Rd, Seattle, WA 98195', lat: 47.6550, lon: -122.2990 },
  'husky basketball': { name: 'Alaska Airlines Arena at Hec Edmundson Pavilion', address: '3900 Montlake Blvd NE, Seattle, WA 98195', lat: 47.6520, lon: -122.3020 },
  'hec edmundson': { name: 'Alaska Airlines Arena at Hec Edmundson Pavilion', address: '3900 Montlake Blvd NE, Seattle, WA 98195', lat: 47.6520, lon: -122.3020 },
  'husky arena': { name: 'Alaska Airlines Arena at Hec Edmundson Pavilion', address: '3900 Montlake Blvd NE, Seattle, WA 98195', lat: 47.6520, lon: -122.3020 },
  'hec ed': { name: 'Alaska Airlines Arena at Hec Edmundson Pavilion', address: '3900 Montlake Blvd NE, Seattle, WA 98195', lat: 47.6520, lon: -122.3020 },
  
  // South Lake Union / Belltown
  'jazz alley': { name: "Dimitriou's Jazz Alley", address: '2033 6th Ave, Seattle, WA 98121', lat: 47.6147, lon: -122.3393 },
  'dimitriou\'s jazz alley': { name: "Dimitriou's Jazz Alley", address: '2033 6th Ave, Seattle, WA 98121', lat: 47.6147, lon: -122.3393 },
  'jazz': { name: "Dimitriou's Jazz Alley", address: '2033 6th Ave, Seattle, WA 98121', lat: 47.6147, lon: -122.3393 },
  'nectar': { name: 'Nectar Lounge', address: '2359 10th Ave E, Seattle, WA 98102', lat: 47.6206, lon: -122.3146 },
  'kremwerk': { name: 'Kremwerk', address: '1809 10th Ave, Seattle, WA 98122', lat: 47.6162, lon: -122.3161 },
  'monkey loft': { name: 'Monkey Loft', address: '2936 4th Ave S, Seattle, WA 98134', lat: 47.5810, lon: -122.3350 },
  'the funhouse': { name: 'The Funhouse', address: '1215 E Pike St, Seattle, WA 98122', lat: 47.6140, lon: -122.3190 },
  
  // Seattle Center
  'climate pledge arena': { name: 'Climate Pledge Arena', address: '305 Harrison St, Seattle, WA 98109', lat: 47.5952, lon: -122.3316 },
  'climate pledge': { name: 'Climate Pledge Arena', address: '305 Harrison St, Seattle, WA 98109', lat: 47.5952, lon: -122.3316 },
  'mopop': { name: 'MoPOP', address: '370 Harrison St, Seattle, WA 98109', lat: 47.6219, lon: -122.3480 },
  'museum of pop culture': { name: 'MoPOP', address: '370 Harrison St, Seattle, WA 98109', lat: 47.6219, lon: -122.3480 },
  'space needle': { name: 'Space Needle', address: '400 Broad St, Seattle, WA 98109', lat: 47.6205, lon: -122.3493 },
  'chihuly': { name: 'Chihuly Garden and Glass', address: '305 Harrison St, Seattle, WA 98109', lat: 47.6206, lon: -122.3506 },
  'seattle center': { name: 'Seattle Center', address: '305 Harrison St, Seattle, WA 98109', lat: 47.6195, lon: -122.3481 },
  
  // SoDo
  't-mobile park': { name: 'T-Mobile Park', address: '1250 1st Ave S, Seattle, WA 98134', lat: 47.5917, lon: -122.3327 },
  'lumen field': { name: 'Lumen Field', address: '800 Occidental Ave S, Seattle, WA 98134', lat: 47.5952, lon: -122.3313 },
  'wamu theater': { name: 'WAMU Theater', address: '800 Occidental Ave S, Seattle, WA 98134', lat: 47.5935, lon: -122.3320 },
  
  // PNB (Pacific Northwest Ballet)
  'pnb': { name: 'Pacific Northwest Ballet', address: '301 Mercer St, Seattle, WA 98109', lat: 47.6247, lon: -122.3481 },
  'pacific northwest ballet': { name: 'Pacific Northwest Ballet', address: '301 Mercer St, Seattle, WA 98109', lat: 47.6247, lon: -122.3481 },
  
  // STG (Seattle Theatre Group) venues
  'stgpresents': { name: 'The 5th Avenue Theatre', address: '1308 5th Ave, Seattle, WA 98101', lat: 47.6118, lon: -122.3286 },
  
  // Seattle Symphony
  'seattlesymphony': { name: 'Benaroya Hall', address: '200 University St, Seattle, WA 98101', lat: 47.6247, lon: -122.3320 },
  
  // Seattle Opera
  'seattleopera': { name: 'Seattle Opera', address: '200 University St, Seattle, WA 98101', lat: 47.6247, lon: -122.3320 },
  
  // Village Theatre
  'villagetheatre': { name: 'Village Theatre', address: '303 Front St N, Issaquah, WA 98027', lat: 47.5301, lon: -122.0326 },
  
  // Edmonds Center for the Arts
  'edmondscenterforthearts': { name: 'Edmonds Center for the Arts', address: '410 4th Ave N, Edmonds, WA 98020', lat: 47.8107, lon: -122.3795 },
  
  // Festival of Color
  'festivalofcolor': { name: 'Redmond Town Center', address: '15600 NE 8th St, Redmond, WA 98052', lat: 47.6177, lon: -122.1206 },
  
  // St. Patrick's Day
  'pike place': { name: 'Pike Place Market', address: '1501 Pike Place, Seattle, WA 98101', lat: 47.6101, lon: -122.3421 },
  
  // Kells Irish Pub
  'kellsseattle': { name: 'Kells Irish Restaurant & Bar', address: '210 Post Alley, Seattle, WA 98101', lat: 47.6130, lon: -122.3410 },
  
  // 19hz / Electronic Music Venues
  'washington hall': { name: 'Washington Hall', address: '153 14th Ave, Seattle, WA 98122', lat: 47.6015, lon: -122.3142 },
  'cherry': { name: 'Cherry Nightclub', address: '1809 10th Ave, Seattle, WA 98122', lat: 47.6162, lon: -122.3161 },
  'substation': { name: 'Substation', address: '645 NW 45th St, Seattle, WA 98107', lat: 47.6617, lon: -122.3661 },
  'high dive': { name: 'High Dive', address: '513 N 36th St, Seattle, WA 98103', lat: 47.6517, lon: -122.3524 },
  'tractor tavern': { name: 'Tractor Tavern', address: '5213 Ballard Ave NW, Seattle, WA 98107', lat: 47.6661, lon: -122.3828 },
  'conor byrne': { name: 'Conor Byrne Pub', address: '5140 Ballard Ave NW, Seattle, WA 98107', lat: 47.6655, lon: -122.3821 },
  'sunset tavern': { name: 'Sunset Tavern', address: '5433 Ballard Ave NW, Seattle, WA 98107', lat: 47.6677, lon: -122.3845 },
  'lo-fi': { name: 'Lo-Fi Performance Gallery', address: '429 Eastlake Ave E, Seattle, WA 98109', lat: 47.6225, lon: -122.3275 },
  're-bar': { name: 'Re-Bar', address: '1114 Howell St, Seattle, WA 98101', lat: 47.6155, lon: -122.3331 },
  'madame lou\'s': { name: 'Madame Lou\'s', address: '2200 2nd Ave, Seattle, WA 98121', lat: 47.6148, lon: -122.3217 },
  'here-after': { name: 'Here-After', address: '2200 2nd Ave, Seattle, WA 98121', lat: 47.6148, lon: -122.3217 },
  'supernova': { name: 'Supernova Seattle', address: '110 S Horton St, Seattle, WA 98134', lat: 47.5843, lon: -122.3338 },
  'the gallery': { name: 'The Gallery', address: '1426 Broadway, Seattle, WA 98122', lat: 47.6133, lon: -122.3211 },
  'ora nightclub': { name: 'Ora Nightclub', address: '2330 1st Ave, Seattle, WA 98121', lat: 47.6151, lon: -122.3481 },
  'trinity': { name: 'Trinity Nightclub', address: '111 Yesler Way, Seattle, WA 98104', lat: 47.6018, lon: -122.3344 },
  'macefield': { name: 'Macefield', address: 'Ballard, Seattle, WA', lat: 47.6693, lon: -122.3862 },
  'sea monster': { name: 'Sea Monster Lounge', address: '2202 N 45th St, Seattle, WA 98103', lat: 47.6616, lon: -122.3323 },
  'central saloon': { name: 'Central Saloon', address: '207 1st Ave S, Seattle, WA 98104', lat: 47.6015, lon: -122.3341 },
  'blue moon': { name: 'Blue Moon Tavern', address: '712 NE 45th St, Seattle, WA 98105', lat: 47.6615, lon: -122.3211 },
  'vortex': { name: 'Vortex', address: 'Seattle, WA', lat: 47.6062, lon: -122.3321 },
  'black lodge': { name: 'The Black Lodge', address: 'Seattle, WA', lat: 47.6062, lon: -122.3321 },
  
  // Irish Club
  'irishclub': { name: 'Irish Club of Seattle', address: '8004 Ashworth Ave N, Seattle, WA 98103', lat: 47.6904, lon: -122.3550 },
  
  // Balkan Night
  'balkannightnw': { name: 'Saint James Cathedral', address: '907 9th Ave, Seattle, WA 98109', lat: 47.6083, lon: -122.3167 },
  
  // Moisture Festival
  'moisturefestival': { name: 'Seattle Center', address: '305 Harrison St, Seattle, WA 98109', lat: 47.6195, lon: -122.3481 },
  
  // Taste Washington
  'tastewashington': { name: 'Seattle Convention Center', address: '705 5th Ave, Seattle, WA 98104', lat: 47.6118, lon: -122.3320 },
  
  // Seattle Golf Show
  'seattlegolfshow': { name: 'Washington State Fair Events Center', address: '110 9th Ave SW, Puyallup, WA 98371', lat: 47.1854, lon: -122.2929 },
  
  // Quilts
  'quiltersanonymous': { name: 'Washington State Fair Events Center', address: '110 9th Ave SW, Puyallup, WA 98371', lat: 47.1854, lon: -122.2929 },
  
  // Pacific Science Center
  'pacificsciencecenter': { name: 'Pacific Science Center', address: '200 2nd Ave N, Seattle, WA 98109', lat: 47.6206, lon: -122.3506 },
  
  // Rain City Dance
  'raincountrydance': { name: 'Rain City Dance', address: '1715 10th Ave E, Seattle, WA 98102', lat: 47.6253, lon: -122.3140 },
  
  // National Folk Festival
  'nffty': { name: 'Seattle Center', address: '305 Harrison St, Seattle, WA 98109', lat: 47.6195, lon: -122.3481 },
  
  // Cirque du Soleil
  'cirquedusoleil': { name: 'Seattle Center', address: '305 Harrison St, Seattle, WA 98109', lat: 47.6195, lon: -122.3481 },
  
  // Evergreen City Ballet
  'evergreencityballet': { name: 'Everett Performing Arts Center', address: '2710 McDougall Ave, Everett, WA 98201', lat: 47.9790, lon: -122.2021 },
  
  // CGPB (Central Grounds)
  'cgpb': { name: 'Seattle Center', address: '305 Harrison St, Seattle, WA 98109', lat: 47.6195, lon: -122.3481 },
  
  // Fever Candlelight Venues
  'the museum of flight': { name: 'The Museum of Flight', address: '9404 E Marginal Way S, Seattle, WA 98108', lat: 47.5188, lon: -122.2965 },
  'museum of flight': { name: 'The Museum of Flight', address: '9404 E Marginal Way S, Seattle, WA 98108', lat: 47.5188, lon: -122.2965 },
  'sparkman cellars': { name: 'Sparkman Cellars', address: '14473 NE 145th St, Woodinville, WA 98072', lat: 47.7337, lon: -122.1487 },
  'the national nordic museum': { name: 'National Nordic Museum', address: '2655 NW Market St, Seattle, WA 98107', lat: 47.6687, lon: -122.3895 },
  'national nordic museum': { name: 'National Nordic Museum', address: '2655 NW Market St, Seattle, WA 98107', lat: 47.6687, lon: -122.3895 },
  'arctic club hotel': { name: 'Arctic Club Hotel', address: '700 3rd Ave, Seattle, WA 98104', lat: 47.6033, lon: -122.3315 },
  'langston hughes performing arts institute': { name: 'Langston Hughes Performing Arts Institute', address: '104 17th Ave S, Seattle, WA 98144', lat: 47.6015, lon: -122.3090 },
  'langston hughes': { name: 'Langston Hughes Performing Arts Institute', address: '104 17th Ave S, Seattle, WA 98144', lat: 47.6015, lon: -122.3090 },

  // Neighborhoods (fallback when exact venue unknown)
  'downtown': { name: 'Downtown Seattle', lat: 47.6062, lon: -122.3321 },
  'downtown seattle': { name: 'Downtown Seattle', lat: 47.6062, lon: -122.3321 },
  'capitol hill': { name: 'Capitol Hill, Seattle', lat: 47.6253, lon: -122.3222 },
  'ballard': { name: 'Ballard, Seattle', lat: 47.6793, lon: -122.3862 },
  'fremont': { name: 'Fremont, Seattle', lat: 47.6693, lon: -122.3417 },
  'queen anne': { name: 'Queen Anne, Seattle', lat: 47.6372, lon: -122.3571 },
  'university district': { name: 'University District, Seattle', lat: 47.6553, lon: -122.3032 },
  'south lake union': { name: 'South Lake Union, Seattle', lat: 47.6185, lon: -122.3389 },
  'belltown': { name: 'Belltown, Seattle', lat: 47.6163, lon: -122.3556 },
  'international district': { name: 'International District, Seattle', lat: 47.5979, lon: -122.3156 },
  'chinatown': { name: 'Chinatown-International District, Seattle', lat: 47.5979, lon: -122.3156 },
  'waterfront': { name: 'Seattle Waterfront', lat: 47.6050, lon: -122.3420 },
  'sodo': { name: 'SoDo, Seattle', lat: 47.5810, lon: -122.3350 },
  'fauntleroy': { name: 'Fauntleroy, Seattle', lat: 47.5240, lon: -122.3770 },
  'rainier valley': { name: 'Rainier Valley, Seattle', lat: 47.5410, lon: -122.2690 },
  'central district': { name: 'Central District, Seattle', lat: 47.6100, lon: -122.3150 },
  
  // Eastside
  'bellevue': { name: 'Bellevue, WA', lat: 47.6101, lon: -122.2015 },
  'redmond': { name: 'Redmond, WA', lat: 47.6740, lon: -122.1215 },
  'kirkland': { name: 'Kirkland, WA', lat: 47.6815, lon: -122.2087 },
  'issaquah': { name: 'Issaquah, WA', lat: 47.5301, lon: -122.0326 },
  'woodinville': { name: 'Woodinville, WA', lat: 47.8109, lon: -122.0656 },
  'renton': { name: 'Renton, WA', lat: 47.4829, lon: -122.2170 },
  'sammamish': { name: 'Sammamish, WA', lat: 47.6163, lon: -122.0356 },
  
  // North
  'shoreline': { name: 'Shoreline, WA', lat: 47.7553, lon: -122.3415 },
  'lynnwood': { name: 'Lynnwood, WA', lat: 47.8109, lon: -122.3020 },
  'edmonds': { name: 'Edmonds, WA', lat: 47.8107, lon: -122.3795 },
  'everett': { name: 'Everett, WA', lat: 47.9790, lon: -122.2021 },
  
  // South Sound
  'tukwila': { name: 'Tukwila, WA', lat: 47.4352, lon: -122.2561 },
  'federal way': { name: 'Federal Way, WA', lat: 47.3223, lon: -122.3126 },
  'kent': { name: 'Kent, WA', lat: 47.3805, lon: -122.2348 },
  'auburn': { name: 'Auburn, WA', lat: 47.3073, lon: -122.2285 },
  'puyallup': { name: 'Puyallup, WA', lat: 47.1854, lon: -122.2929 },
  'tacoma': { name: 'Tacoma, WA', lat: 47.2529, lon: -122.4443 },
  'lacey': { name: 'Lacey, WA', lat: 47.0369, lon: -122.8003 },
  'olympia': { name: 'Olympia, WA', lat: 47.0379, lon: -122.9005 },
  'monroe': { name: 'Monroe, WA', lat: 47.8553, lon: -121.9718 },
  
  // Generic Seattle fallback
  'seattle': { name: 'Seattle, WA', lat: 47.6062, lon: -122.3321 },
  'seattle, wa': { name: 'Seattle, WA', lat: 47.6062, lon: -122.3321 },
  'seattle wa': { name: 'Seattle, WA', lat: 47.6062, lon: -122.3321 },
  'wa': { name: 'Washington', lat: 47.6062, lon: -122.3321 },
};

// Domain to venue lookup - maps URL domains to venue info
// This is used as a fallback when venue name matching fails (e.g., garbled Events12 data)
const DOMAIN_VENUES: Record<string, Location> = {
  'stgpresents.org': { name: 'The 5th Avenue Theatre', address: '1308 5th Ave, Seattle, WA 98101', lat: 47.6118, lon: -122.3286 },
  '5thavenue.org': { name: 'The 5th Avenue Theatre', address: '1308 5th Ave, Seattle, WA 98101', lat: 47.6118, lon: -122.3286 },
  'stgpresents.com': { name: 'The 5th Avenue Theatre', address: '1308 5th Ave, Seattle, WA 98101', lat: 47.6118, lon: -122.3286 },
  'paramounttheatre.com': { name: 'Paramount Theatre', address: '911 Pine St, Seattle, WA 98101', lat: 47.6129, lon: -122.3320 },
  'paramounttheatreseattle.com': { name: 'Paramount Theatre', address: '911 Pine St, Seattle, WA 98101', lat: 47.6129, lon: -122.3320 },
  'mooretheatre.com': { name: 'The Moore Theatre', address: '1932 2nd Ave, Seattle, WA 98101', lat: 47.6147, lon: -122.3421 },
  'showboxsodo.com': { name: 'Showbox SoDo', address: '1700 1st Ave S, Seattle, WA 98134', lat: 47.5810, lon: -122.3350 },
  'showboxonline.com': { name: 'The Showbox', address: '1426 1st Ave, Seattle, WA 98101', lat: 47.6122, lon: -122.3267 },
  'neumos.com': { name: 'Neumos', address: '925 E Pike St, Seattle, WA 98122', lat: 47.6147, lon: -122.3193 },
  'crocodileonline.com': { name: 'The Crocodile', address: '2200 2nd Ave, Seattle, WA 98121', lat: 47.6148, lon: -122.3217 },
  'barbozaseattle.com': { name: 'Barboza', address: '925 E Pike St, Seattle, WA 98122', lat: 47.6147, lon: -122.3193 },
  'benaroyahall.org': { name: 'Benaroya Hall', address: '200 University St, Seattle, WA 98101', lat: 47.6247, lon: -122.3320 },
  'seattlesymphony.org': { name: 'Benaroya Hall', address: '200 University St, Seattle, WA 98101', lat: 47.6247, lon: -122.3320 },
  'seattleopera.org': { name: 'Seattle Opera', address: '200 University St, Seattle, WA 98101', lat: 47.6247, lon: -122.3320 },
  'pnb.org': { name: 'Pacific Northwest Ballet', address: '301 Mercer St, Seattle, WA 98109', lat: 47.6247, lon: -122.3481 },
  'jazzalley.com': { name: "Dimitriou's Jazz Alley", address: '2033 6th Ave, Seattle, WA 98121', lat: 47.6147, lon: -122.3393 },
  'climategpledgearena.com': { name: 'Climate Pledge Arena', address: '305 Harrison St, Seattle, WA 98109', lat: 47.5952, lon: -122.3316 },
  'tmobilepark.com': { name: 'T-Mobile Park', address: '1250 1st Ave S, Seattle, WA 98134', lat: 47.5917, lon: -122.3327 },
  'seahawks.com': { name: 'Lumen Field', address: '800 Occidental Ave S, Seattle, WA 98134', lat: 47.5952, lon: -122.3313 },
  'mariners.com': { name: 'T-Mobile Park', address: '1250 1st Ave S, Seattle, WA 98134', lat: 47.5917, lon: -122.3327 },
  'soundersfc.com': { name: 'Lumen Field', address: '800 Occidental Ave S, Seattle, WA 98134', lat: 47.5952, lon: -122.3313 },
  'uw huskies.com': { name: 'Husky Stadium', address: '3800 Montlake Blvd NE, Seattle, WA 98195', lat: 47.6505, lon: -122.3318 },
  'gomighty.com': { name: 'Husky Stadium', address: '3800 Montlake Blvd NE, Seattle, WA 98195', lat: 47.6505, lon: -122.3318 },
  'mopop.org': { name: 'MoPOP', address: '370 Harrison St, Seattle, WA 98109', lat: 47.6219, lon: -122.3480 },
  'spaceneedle.com': { name: 'Space Needle', address: '400 Broad St, Seattle, WA 98109', lat: 47.6205, lon: -122.3493 },
  'chihulygardenandglass.com': { name: 'Chihuly Garden and Glass', address: '305 Harrison St, Seattle, WA 98109', lat: 47.6206, lon: -122.3506 },
  'nectarlounge.com': { name: 'Nectar Lounge', address: '2359 10th Ave E, Seattle, WA 98102', lat: 47.6206, lon: -122.3146 },
  'kremwerk.com': { name: 'Kremwerk', address: '1809 10th Ave, Seattle, WA 98122', lat: 47.6162, lon: -122.3161 },
  'substationsf.com': { name: 'Substation', address: '1809 10th Ave, Seattle, WA 98122', lat: 47.6162, lon: -122.3161 },
  'monkeyloft.com': { name: 'Monkey Loft', address: '2936 4th Ave S, Seattle, WA 98134', lat: 47.5810, lon: -122.3350 },
  'funhouse.seattle.com': { name: 'The Funhouse', address: '1215 E Pike St, Seattle, WA 98122', lat: 47.6140, lon: -122.3190 },
  'timbreroom.com': { name: 'Timbre Room', address: '1809 10th Ave, Seattle, WA 98122', lat: 47.6162, lon: -122.3161 },
  'chopsueyseattle.com': { name: 'Chop Suey', address: '1325 E Madison St, Seattle, WA 98122', lat: 47.6145, lon: -122.3167 },
  'qnightclub.com': { name: 'Q Nightclub', address: '1422 Post Alley, Seattle, WA 98101', lat: 47.6133, lon: -122.3410 },
  'villagetheatre.org': { name: 'Village Theatre', address: '303 Front St N, Issaquah, WA 98027', lat: 47.5301, lon: -122.0326 },
  'edmondscenterforthearts.org': { name: 'Edmonds Center for the Arts', address: '410 4th Ave N, Edmonds, WA 98020', lat: 47.8107, lon: -122.3795 },
  'festivalofcolorwa.com': { name: 'Redmond Town Center', address: '15600 NE 8th St, Redmond, WA 98052', lat: 47.6177, lon: -122.1206 },
  'kellsseattle.com': { name: 'Kells Irish Restaurant & Bar', address: '210 Post Alley, Seattle, WA 98101', lat: 47.6130, lon: -122.3410 },
  'balkannightnw.com': { name: 'Saint James Cathedral', address: '907 9th Ave, Seattle, WA 98109', lat: 47.6083, lon: -122.3167 },
  'moisturefestival.org': { name: 'Seattle Center', address: '305 Harrison St, Seattle, WA 98109', lat: 47.6195, lon: -122.3481 },
  'tastewashington.org': { name: 'Seattle Convention Center', address: '705 5th Ave, Seattle, WA 98104', lat: 47.6118, lon: -122.3320 },
  'pacificsciencecenter.org': { name: 'Pacific Science Center', address: '200 2nd Ave N, Seattle, WA 98109', lat: 47.6206, lon: -122.3506 },
  'raincountrydance.org': { name: 'Rain City Dance', address: '1715 10th Ave E, Seattle, WA 98102', lat: 47.6253, lon: -122.3140 },
  'nffty.org': { name: 'Seattle Center', address: '305 Harrison St, Seattle, WA 98109', lat: 47.6195, lon: -122.3481 },
  'cirquedusoleil.com': { name: 'Seattle Center', address: '305 Harrison St, Seattle, WA 98109', lat: 47.6195, lon: -122.3481 },
  'cirquedusoleil.ca': { name: 'Seattle Center', address: '305 Harrison St, Seattle, WA 98109', lat: 47.6195, lon: -122.3481 },
  'evergreencityballet.org': { name: 'Everett Performing Arts Center', address: '2710 McDougall Ave, Everett, WA 98201', lat: 47.9790, lon: -122.2021 },
};

// Extract domain from URL for venue lookup
function extractDomain(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    // Remove www. prefix
    return hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function generateEventId(event: RawScrapedEvent): string {
  // Include venue to avoid duplicate IDs for same event at different venues
  const venue = event.location_name || event.location_address || '';
  const str = `${event.title}-${event.date || 'undated'}-${event.source}-${venue}`.slice(0, 100);
  return createHash('sha256').update(str).digest('hex').slice(0, 12);
}

function parseDate(dateStr: string | undefined): { start_time: string; end_time: string } {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  if (!dateStr) {
    return {
      start_time: `${today}T19:00:00`,
      end_time: `${today}T22:00:00`,
    };
  }

  // If already in ISO format (YYYY-MM-DD), use it directly
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const datePart = dateStr.substring(0, 10);
    const timeMatch = dateStr.match(/(\d{2}):(\d{2}):(\d{2})/);
    const startHour = timeMatch ? parseInt(timeMatch[1]) : 19;
    const startMin = timeMatch ? parseInt(timeMatch[2]) : 0;
    const endHour = startHour + 2;
    return {
      start_time: `${datePart}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`,
      end_time: `${datePart}T${String(endHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`,
    };
  }

  let startHour = 19;
  let startMin = 0;
  let endHour = 22;
  let endMin = 0;

  const timeWithAmPm = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/gi;
  const timeMatches = [...dateStr.matchAll(timeWithAmPm)];
  
  if (timeMatches.length > 0) {
    const firstTime = timeMatches[0];
    startHour = parseInt(firstTime[1]);
    startMin = firstTime[2] ? parseInt(firstTime[2]) : 0;
    const ampm = (firstTime[3] || '').replace(/\./g, '').toLowerCase();
    if (ampm === 'pm' && startHour < 12) startHour += 12;
    if (ampm === 'am' && startHour === 12) startHour = 0;
  }

  if (timeMatches.length > 1) {
    const secondTime = timeMatches[1];
    endHour = parseInt(secondTime[1]);
    endMin = secondTime[2] ? parseInt(secondTime[2]) : 0;
    const ampm = (secondTime[3] || '').replace(/\./g, '').toLowerCase();
    if (ampm === 'pm' && endHour < 12) endHour += 12;
    if (ampm === 'am' && endHour === 12) endHour = 0;
  } else {
    endHour = startHour + 2;
  }

  const cleanDateStr = dateStr.replace(/\(.*?\)/g, '').replace(/\d{1,2}(:\d{2})?\s*(am|pm)/gi, '').trim();
  
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const monthShortNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sept', 'sep', 'oct', 'nov', 'dec'];
  const monthPattern = `(${monthNames.join('|')}|${monthShortNames.join('|')})\\.?`;
  const monthMatch = cleanDateStr.toLowerCase().match(new RegExp(`${monthPattern}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  const dateNumMatch = cleanDateStr.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  
  let startTime = today;
  let endTime = today;
  
  if (monthMatch) {
    let monthIndex = monthNames.indexOf(monthMatch[1]);
    if (monthIndex === -1) {
      monthIndex = monthShortNames.indexOf(monthMatch[1]);
    }
    const month = monthIndex + 1;
    const day = parseInt(monthMatch[2]);
    startTime = `${now.getFullYear()}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  } else if (dateNumMatch) {
    const month = parseInt(dateNumMatch[1]);
    const day = parseInt(dateNumMatch[2]);
    const year = dateNumMatch[3] ? parseInt(dateNumMatch[3]) : now.getFullYear();
    const fullYear = year < 100 ? 2000 + year : year;
    startTime = `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const dayOfWeek: Record<string, number> = {
    'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
    'thursday': 4, 'friday': 5, 'saturday': 6,
  };

  const dayMatch = dateStr.toLowerCase().match(/(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i);
  if (dayMatch && !monthMatch && !dateNumMatch) {
    const targetDay = dayOfWeek[dayMatch[1].toLowerCase()];
    const currentDay = now.getDay();
    let daysToAdd = targetDay - currentDay;
    if (daysToAdd <= 0) daysToAdd += 7;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + daysToAdd);
    startTime = targetDate.toISOString().split('T')[0];
  }

  endTime = startTime;

  return {
    start_time: `${startTime}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`,
    end_time: `${endTime}T${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`,
  };
}

function parseLocation(locationName: string | undefined, eventUrl?: string, eventLat?: number, eventLon?: number): Location {
  if (!locationName) locationName = '';

  // 1. If we have exact coordinates provided by the scraper (e.g., Ticketmaster), use them!
  if (eventLat !== undefined && eventLon !== undefined) {
     return {
        name: locationName || 'Seattle, WA',
        lat: eventLat,
        lon: eventLon
     };
  }

  const lower = locationName.toLowerCase();

  // First try to match venue name
  for (const [key, coords] of Object.entries(KNOWN_VENUES)) {
    if (lower.includes(key)) {
      return coords;
    }
  }

  // If venue name lookup failed, try URL domain lookup
  if (eventUrl) {
    const domain = extractDomain(eventUrl);
    if (domain) {
      // Try exact domain match first
      if (DOMAIN_VENUES[domain]) {
        return DOMAIN_VENUES[domain];
      }
      // Try partial match (e.g., "stgpresents.org" matches "www.stgpresents.org")
      for (const [key, venue] of Object.entries(DOMAIN_VENUES)) {
        if (domain.includes(key) || key.includes(domain)) {
          return venue;
        }
      }
    }
  }

  const addressMatch = locationName.match(/(\d{1,5})\s+(\w+)/);
  if (addressMatch) {
    return {
      name: locationName,
      lat: 47.6062,
      lon: -122.3321,
    };
  }

  return {
    name: locationName,
    lat: DEFAULT_SEATTLE_COORDS.lat,
    lon: DEFAULT_SEATTLE_COORDS.lon,
  };
}

export function regeocodeEvent(event: any): any {
  const location = parseLocation(event.location?.name, event.url);
  return {
    ...event,
    location: {
      ...event.location,
      name: location.name,
      lat: location.lat,
      lon: location.lon,
    },
  };
}

function estimateIsKidFriendly(event: RawScrapedEvent): boolean {
  const text = `${event.title} ${event.description} ${event.location_name}`.toLowerCase();

  const adultIndicators = [
    { pattern: /\b(21|18|plus)\s*\+?\b/i, name: '21+/18+' },
    { pattern: /\b(adults?\s*only|21\s*and\s*over|18\s*and\s*over)\b/i, name: 'adults only' },
    { pattern: /\b(nightclub|dance\s*club|speakeasy)\b/i, name: 'nightclub' },
    { pattern: /\b(cocktail\s*bar|wine\s*bar|brewery)\b/i, name: 'bar' },
    { pattern: /\b(late\s*night|after\s*dark)\b/i, name: 'late night' },
    { pattern: /\b(pub\s*crawl|bar\s*crawl)\b/i, name: 'pub crawl' },
    { pattern: /\b(strip|gentleman|ladies\s*night)\b/i, name: 'adult venue' },
  ];

  // Highest priority: Explicit "All ages" or "21+"
  if (text.includes('all ages')) return true;
  if (text.includes('21+') || text.includes('18+') || text.includes('21 and over') || text.includes('18 and over')) return false;

  for (const { pattern, name } of adultIndicators) {
    if (pattern.test(text)) return false;
  }

  const kidFriendlyIndicators = [
    { pattern: /\b(family|kids?|children|all\s*ages)\b/i, name: 'family' },
    { pattern: /\b(farmers?\s*market|market)\b/i, name: 'market' },
    { pattern: /\b(zoo|aquarium|museum)\b/i, name: 'zoo/aquarium/museum' },
    { pattern: /\b(park|playground|trail|hike)\b/i, name: 'outdoor' },
    { pattern: /\b(story\s*time|music\s*class|kids\s*club)\b/i, name: 'kids activity' },
    { pattern: /\b(festival|fair|celebration)\b/i, name: 'festival' },
    { pattern: /\b(movie\s*night|film|concert)\b/i, name: 'film/concert' },
  ];

  for (const { pattern, name } of kidFriendlyIndicators) {
    if (pattern.test(text)) return true;
  }

  if (text.includes('bar') || text.includes('brew') || text.includes('night')) {
    return false;
  }

  return true;
}

function estimateVibeTags(event: RawScrapedEvent): string[] {
  const text = `${event.title} ${event.description} ${event.location_name}`.toLowerCase();
  const tags: string[] = [];

  const tagMappings: [string, string[]][] = [
    ['tech', ['tech', 'technology', 'code', 'developer', 'software', 'ai', 'startup', 'coding', 'programming', 'data science', 'machine learning', 'llm']],
    ['bass', ['bass', 'dubstep', 'trap', 'dnb', 'drum and bass', 'riddim', 'low end']],
    ['house', ['house', 'tech house', 'deep house', 'progressive house', 'disco', 'funk', 'groove']],
    ['techno', ['techno', 'hard techno', 'industrial', 'dark techno', 'minimal techno']],
    ['trance', ['trance', 'psytrance', 'progressive trance', 'uplifting trance']],
    ['electronic', ['electronic', 'edm', 'synth', 'modular', 'experimental', 'ambient', 'beats', 'flow arts']],
    ['music', ['music', 'concert', 'live music', 'dj', 'band', 'jazz', 'rock', 'hip hop', 'folk', 'indie', 'orchestra', 'symphony', 'acoustic']],
    ['food', ['food', 'dinner', 'lunch', 'brunch', 'restaurant', 'tasting', 'cooking', 'chef', 'wine tasting', 'brewery', 'food truck', 'pizza']],
    ['outdoor', ['outdoor', 'hike', 'walk', 'park', 'trail', 'kayak', 'paddle', 'camping', 'climbing', 'biking', 'running', 'fitness', 'nature']],
    ['sports', ['sports', 'game', 'match', 'watch party', 'seahawks', 'mariners', 'sounders', 'tennis', 'golf', 'football', 'baseball', 'soccer']],
    ['art', ['art', 'gallery', 'exhibit', 'museum', 'theater', 'theatre', 'film', 'dance', 'performance', 'opera', 'ballet', 'comedy']],
    ['drinks', ['drinks', 'wine', 'beer', 'cocktail', 'brew', 'happy hour', 'pub', 'bar', 'speakeasy', 'tasting']],
    ['market', ['market', 'fair', 'festival', 'vendor', 'craft', 'artisan', 'farmers', 'flea', 'pop-up']],
    ['education', ['education', 'class', 'workshop', 'learn', 'talk', 'meetup', 'conference', 'seminar', 'training']],
    ['nightlife', ['nightlife', 'night', 'evening', 'late', 'club', 'party', 'dance', 'clubbing']],
    ['family', ['family', 'kids', 'children', 'all ages', 'parent', 'tot']],
    ['fitness', ['fitness', 'yoga', 'pilates', 'gym', 'workout', 'run', 'marathon', 'spin', 'crossfit']],
    ['wellness', ['wellness', 'health', 'spa', 'meditation', 'yoga', 'sound bath', 'healing', 'reiki']],
    ['community', ['community', 'volunteer', 'meetup', 'social', 'network', 'connect', 'group']],
  ];

  for (const [tag, keywords] of tagMappings) {
    if (keywords.some(kw => text.includes(kw)) && !tags.includes(tag)) {
      tags.push(tag);
    }
  }

  if (tags.length === 0) tags.push('general');

  return tags.slice(0, 3);
}

export function enrichEvent(event: RawScrapedEvent): EnrichedEvent {
  const times = parseDate(event.date || '');
  const location = parseLocation(event.location_name, event.url, event.location_lat, event.location_lon);

  return {
    id: generateEventId(event),
    source: event.source,
    title: event.title,
    description: event.description || `Event at ${event.location_name || 'Seattle'}`,
    start_time: times.start_time,
    end_time: times.end_time,
    price: event.price,
    sessions: event.sessions,
    is_kid_friendly: estimateIsKidFriendly(event),
    vibe_tags: estimateVibeTags(event),
    location: {
      ...location,
      // Use scraped address if available, otherwise use the one from parseLocation
      address: event.location_address || location.address,
    },
    url: event.url || '',
    image: event.image,
    ticket_url: event.ticket_url,
    map_url: event.map_url,
    video_url: event.video_url,
  };
}

export async function enrichAllEvents(events: RawScrapedEvent[]): Promise<EnrichedEvent[]> {
  console.log(`[Enrichment] Processing ${events.length} events...`);
  
  // Deduplicate events before enrichment - use title + date + source + location
  const seenKeys = new Set<string>();
  const uniqueEvents: RawScrapedEvent[] = [];
  for (const event of events) {
    const key = `${event.title}-${event.date || ''}-${event.source}-${event.location_name || ''}-${event.location_address || ''}`.toLowerCase();
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    uniqueEvents.push(event);
  }
  
  if (uniqueEvents.length < events.length) {
    console.log(`[Enrichment] Removed ${events.length - uniqueEvents.length} duplicates before enrichment`);
  }
  
  const enrichedEvents = uniqueEvents.map(enrichEvent);

  // Final date validation pass - fix any invalid dates
  const today = new Date().toISOString().split('T')[0];
  let fixedCount = 0;
  for (const event of enrichedEvents) {
    if (!isValidDateString(event.start_time)) {
      event.start_time = `${today}T19:00:00`;
      event.end_time = `${today}T22:00:00`;
      fixedCount++;
    }
  }
  if (fixedCount > 0) {
    console.log(`[Enrichment] Fixed ${fixedCount} invalid dates`);
  }

  const kidFriendlyCount = enrichedEvents.filter(e => e.is_kid_friendly).length;
  const tagCounts: Record<string, number> = {};
  for (const event of enrichedEvents) {
    for (const tag of event.vibe_tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }

  console.log(`[Enrichment] Complete. ${enrichedEvents.length} events enriched.`);
  console.log(`[Enrichment] Kid-friendly: ${kidFriendlyCount}/${enrichedEvents.length}`);
  console.log(`[Enrichment] Top tags:`, Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k}(${v})`).join(', '));

  return enrichedEvents;
}
