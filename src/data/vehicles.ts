import { VehicleStats } from '../types/game';

export const VEHICLE_LIST: VehicleStats[] = [
  {
    id: 'Car_06',
    name: 'Coupe Turbo 06',
    category: 'Sports Classic',
    description: 'Agile sports coupe with balanced handling and sharp acceleration. Great for city street cruising.',
    topSpeedKmh: 110,
    acceleration: 85,
    handling: 82,
    mass: 1200,
    driftFactor: 0.88,
    colorHex: '#38bdf8',
    modelFile: '/models/vehicles/Car_06.glb',
    drivetrain: 'rwd'
  },
  {
    id: 'Car_13',
    name: 'Aero GT-13',
    category: 'Track Racer',
    description: 'Equipped with a high-downforce rear spoiler. Maximum acceleration and aggressive drift capability.',
    topSpeedKmh: 128,
    acceleration: 92,
    handling: 90,
    mass: 1100,
    driftFactor: 0.94,
    colorHex: '#ef4444',
    modelFile: '/models/vehicles/Car_13.glb',
    drivetrain: 'rwd'
  },
  {
    id: 'Car_16',
    name: 'Urban Prime 16',
    category: 'Executive Sedan',
    description: 'Smooth, reliable, and comfortable cruiser with stable road-holding on tight corners.',
    topSpeedKmh: 98,
    acceleration: 72,
    handling: 78,
    mass: 1400,
    driftFactor: 0.75,
    colorHex: '#10b981',
    modelFile: '/models/vehicles/Car_16.glb',
    drivetrain: 'awd'
  },
  {
    id: 'Car_19',
    name: 'Pocket Swift 19',
    category: 'Micro Hatchback',
    description: 'Ultra-lightweight compact. High turning radius and instant maneuverability through narrow alleys.',
    topSpeedKmh: 90,
    acceleration: 76,
    handling: 94,
    mass: 950,
    driftFactor: 0.82,
    colorHex: '#f59e0b',
    modelFile: '/models/vehicles/Car_19.glb',
    drivetrain: 'fwd'
  },
  {
    id: 'Futuristic_Car_1',
    name: 'Cyber Nova-X',
    category: 'Hyper Concept',
    description: 'Experimental electric hypercar with extreme top speed and low ground clearance.',
    topSpeedKmh: 145,
    acceleration: 98,
    handling: 86,
    mass: 1300,
    driftFactor: 0.90,
    colorHex: '#8b5cf6',
    modelFile: '/models/vehicles/Futuristic_Car_1.glb',
    drivetrain: 'awd'
  },
  {
    id: 'Van',
    name: 'City Express Van',
    category: 'Utility Van',
    description: 'Heavy commercial transport van. High torque and solid momentum with sturdy suspension.',
    topSpeedKmh: 82,
    acceleration: 60,
    handling: 65,
    mass: 1900,
    driftFactor: 0.60,
    colorHex: '#64748b',
    modelFile: '/models/vehicles/Van.glb',
    drivetrain: 'rwd'
  },
  {
    id: 'Bus',
    name: 'Metro Transit Bus',
    category: 'Public Transit',
    description: 'Heavy-duty city commuter bus. Massive chassis plows through traffic and absorbs collisions with unstoppable momentum.',
    topSpeedKmh: 80,
    acceleration: 56,
    handling: 58,
    mass: 4200,
    driftFactor: 0.45,
    colorHex: '#eab308',
    modelFile: '/models/vehicles/Bus.glb',
    drivetrain: 'rwd'
  }
];

export const CITY_POIS = [
  {
    id: 'twisted-tower',
    name: 'Twisted Tower',
    category: 'Landmark' as const,
    description: 'A 48-meter architectural icon with spiral twisting cantilever balconies.',
    position: [31.6, 0, 47.6] as [number, number, number],
    color: '#00f0ff',
    rewardText: 'Discovered: City Landmark'
  },
  {
    id: 'fountain-plaza',
    name: 'North Fountain Plaza',
    category: 'Plaza' as const,
    description: 'Pedestrian gathering square centered around the grand dual fountain.',
    position: [-12.6, 0, 30.2] as [number, number, number],
    color: '#3b82f6',
    rewardText: 'Discovered: Relaxation Square'
  },
  {
    id: 'city-garage',
    name: 'Downtown Garage & Workshop',
    category: 'Garage' as const,
    description: 'Vehicle tuning workshop. Walk up to any car in the city streets and press [E] to enter or hijack it!',
    position: [-22.0, 0, 15.0] as [number, number, number],
    color: '#10b981',
    rewardText: 'Vehicle Workshop Discovered'
  },
  {
    id: 'transit-hub',
    name: 'Avenue Transit Stop',
    category: 'Transit' as const,
    description: 'Major transit shelter connecting the eastern corporate district to downtown.',
    position: [46.2, 0, -23.5] as [number, number, number],
    color: '#f59e0b',
    rewardText: 'Discovered: Transit Terminal'
  },
  {
    id: 'eco-terrace',
    name: 'Eco Terraces Complex',
    category: 'Scenic' as const,
    description: 'Sustainable tiered high-rise featuring vertical gardens and rooftop solar arrays.',
    position: [33.4, 0, -40.3] as [number, number, number],
    color: '#8b5cf6',
    rewardText: 'Discovered: Green Architecture'
  },
  {
    id: 'ocean-marina',
    name: 'West Ocean Marina',
    category: 'Scenic' as const,
    description: 'Bustling coastal harbor promenade overlooking the sparkling blue ocean waters.',
    position: [-52.0, 0, -35.0] as [number, number, number],
    color: '#06b6d4',
    rewardText: 'Discovered: Ocean Marina'
  },
  {
    id: 'grand-bank',
    name: 'Metropolitan Reserve Bank',
    category: 'Landmark' as const,
    description: 'Financial center skyscraper with gilded pillars and executive helipad.',
    position: [-38.0, 0, 52.0] as [number, number, number],
    color: '#eab308',
    rewardText: 'Discovered: Financial District'
  },
  {
    id: 'sunset-pier',
    name: 'South Sunset Pier',
    category: 'Scenic' as const,
    description: 'Oceanfront boardwalk offering panoramic vistas of the coastal skyline.',
    position: [12.0, 0, -65.0] as [number, number, number],
    color: '#f97316',
    rewardText: 'Discovered: Sunset Boardwalk'
  },
  {
    id: 'grand-hotel',
    name: 'Skyline Grand Hotel',
    category: 'Plaza' as const,
    description: 'Five-star luxury destination with valet driveways and crystal chandeliers.',
    position: [48.0, 0, 62.0] as [number, number, number],
    color: '#ec4899',
    rewardText: 'Discovered: Luxury Grand Hotel'
  }
];
