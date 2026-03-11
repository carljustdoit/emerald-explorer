export const mockEvents = [
    {
        id: 1,
        title: "Seattle Aquarium Touch Pool",
        description: "Experience the magic of Puget Sound tide pools. Touch sea stars, anemones, and urchins in a hands-on learning environment guided by expert biologists.",
        location: "Pier 59, Seattle Waterfront",
        time: "10:00 AM - 5:00 PM",
        price: "$25",
        link: "https://www.seattleaquarium.org",
        startDate: new Date(),
        isKidFriendly: true,
        category: "Education",
        vibe: "Educational & Chill",
        image: "https://images.unsplash.com/photo-1544551763-77ef2d0ca036?auto=format&fit=crop&q=80&w=800",
        coord: { x: 47.6074, y: -122.3430 }
    },
    {
        id: 2,
        title: "EDM Late Night Set",
        description: "Deep house and melodic techno pulse through the night at Seattle's premiere underground club. Featuring local and international DJs.",
        location: "Capitol Hill, Seattle",
        time: "10:00 PM - 2:00 AM",
        price: "$30",
        link: "https://qseattle.com",
        startDate: new Date(Date.now() + 86400000),
        isKidFriendly: false,
        category: "Music",
        vibe: "Electric & High Energy",
        image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=800",
        coord: { x: 47.6145, y: -122.3210 }
    },
    {
        id: 3,
        title: "Lake Union Kayak Paddle",
        description: "Gently navigate the heart of the city. Watch the seaplanes take off and enjoy unparalleled views of the Space Needle from the water.",
        location: "Lake Union Park",
        time: "4:00 PM - Sunset",
        price: "Free (BYO Gear)",
        link: "https://www.seattle.gov/parks",
        startDate: new Date(Date.now() + 3600000),
        isKidFriendly: true,
        category: "Nature",
        vibe: "Serene & Active",
        image: "https://images.unsplash.com/photo-1559523161-0fc0d8b38a7a?auto=format&fit=crop&q=80&w=800",
        coord: { x: 47.6253, y: -122.3370 }
    },
    {
        id: 4,
        title: "Snoqualmie Night Skiing",
        description: "Carve through fresh powder under the stars. The Summit at Snoqualmie offers the best night skiing in the region.",
        location: "Snoqualmie Pass",
        time: "4:00 PM - 10:00 PM",
        price: "$85 (Pass Required)",
        link: "https://summitatsnoqualmie.com",
        startDate: new Date(Date.now() + 7200000),
        isKidFriendly: false,
        category: "Sports",
        vibe: "High Speed & Cold",
        image: "https://images.unsplash.com/photo-1551698618-1fed5d96559e?auto=format&fit=crop&q=80&w=800",
        coord: { x: 47.4241, y: -121.4137 }
    },
    {
        id: 5,
        title: "Sound Healing Workshop",
        description: "A meditative journey through crystal bowls, gongs, and ambient textures. Focus on restoration and neural recalibration.",
        location: "Ballard Yoga Collective",
        time: "6:00 PM - 7:30 PM",
        price: "$45",
        link: "https://ballardyoga.com",
        startDate: new Date(Date.now() + 172800000),
        isKidFriendly: true,
        category: "Healing",
        vibe: "Deep Restoration",
        image: "https://images.unsplash.com/photo-1514533212735-5df27d970db0?auto=format&fit=crop&q=80&w=800",
        coord: { x: 47.6687, y: -122.3848 }
    }
];

export const mockResources = [
    { id: 1, name: "Oru Kayak", type: "gear", isAvailable: true },
    { id: 2, name: "Ikon Pass", type: "pass", isAvailable: true }
];
