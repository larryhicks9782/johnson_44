import { Gathering, Category, UserProfile } from './types';

export const CATEGORIES: Category[] = ['Arts & Culture', 'Wellness', 'Social', 'Learning', 'Nature', 'Food'];

export const SEED_USERS: UserProfile[] = [
  {
    id: 'user-1',
    name: 'Elena V.',
    bio: 'Poet, dreamer, and lover of old trees. I believe in the power of words to heal and connect.',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&auto=format&fit=crop',
    interests: ['Arts & Culture', 'Nature'],
    joinedDate: '2026-01-10'
  },
  {
    id: 'user-2',
    name: 'Marcus Rose',
    bio: 'Yoga instructor and sound healer. Finding peace in the early morning light.',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop',
    interests: ['Wellness', 'Social'],
    joinedDate: '2026-02-15'
  },
  {
    id: 'user-3',
    name: 'Baker Sam',
    bio: 'Obsessed with wild yeast and crusty bread. Teaching the world to bake, one loaf at a time.',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop',
    interests: ['Learning', 'Food'],
    joinedDate: '2026-03-20'
  }
];

export const CURRENT_USER: UserProfile = {
  id: 'me',
  name: 'Alex Rivera',
  bio: 'Newcomer looking for community and cool local events. I love learning new skills and meeting people.',
  avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&auto=format&fit=crop',
  interests: ['Nature', 'Learning', 'Social'],
  joinedDate: '2026-04-01'
};

export const SEED_GATHERINGS: Gathering[] = [
  {
    id: '1',
    title: 'Poetry in the Park',
    description: 'A cozy afternoon shared reading favorite verses under the ancient oaks.',
    category: 'Arts & Culture',
    date: '2026-05-12',
    time: '14:00',
    location: 'Willow Creek Meadow',
    lat: 42,
    lng: 35,
    hostId: 'user-1',
    hostName: 'Elena V.',
    hostAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&auto=format&fit=crop',
    attendeeIds: ['me', 'user-2', 'user-3'],
    maybeIds: [],
    capacity: 15,
    image: 'https://images.unsplash.com/photo-1518173946687-a4c8a9b749f5?w=800&auto=format&fit=crop',
    tags: ['Arts & Culture', 'Nature', 'Social']
  },
  {
    id: '2',
    title: 'Sunrise Yoga & Sound',
    description: 'Gentle flow followed by a meditative sound bath at dawn.',
    category: 'Wellness',
    date: '2026-05-15',
    time: '06:30',
    location: 'The Zen Deck',
    lat: 65,
    lng: 72,
    hostId: 'user-2',
    hostName: 'Marcus Rose',
    hostAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop',
    attendeeIds: ['me', 'user-1'],
    maybeIds: [],
    capacity: 20,
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&auto=format&fit=crop',
    tags: ['Wellness', 'Nature', 'Social']
  },
  {
     id: '3',
     title: 'Bread Making workshop',
     description: 'Learn the secrets of sourdough starters and slow fermentation.',
     category: 'Learning',
     date: '2026-05-20',
     time: '10:00',
     location: 'Community Kitchen Lab',
     lat: 28,
     lng: 60,
     hostId: 'user-3',
     hostName: 'Baker Sam',
     hostAvatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop',
     attendeeIds: [],
     maybeIds: [],
     capacity: 6,
     image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&auto=format&fit=crop',
     tags: ['Learning', 'Food', 'Social']
   },
   {
     id: '4',
     title: 'Community Gardening Day',
     description: 'Join us as we plant seasonal vegetables and learn sustainable gardening practices in a welcoming, collaborative environment.',
     category: 'Nature',
     date: '2026-05-25',
     time: '09:00',
     location: 'Old Oak Botanical Gardens',
     lat: 50,
     lng: 25,
     hostId: 'user-1',
     hostName: 'Elena V.',
     hostAvatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&auto=format&fit=crop',
     attendeeIds: ['me'],
     maybeIds: ['user-2'],
     capacity: 25,
     image: 'https://images.unsplash.com/photo-1464207687429-7505649dae38?w=800&auto=format&fit=crop',
     tags: ['Nature', 'Learning', 'Social']
   }
 ];
