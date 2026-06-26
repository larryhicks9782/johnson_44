export type Category = 'Arts & Culture' | 'Wellness' | 'Social' | 'Learning' | 'Nature' | 'Food';

export interface Gathering {
  id: string;
  title: string;
  description: string;
  category: Category;
  date: string;
  time: string;
  location: string;
  lat: number;
  lng: number;
  hostId: string;
  hostName: string;
  hostAvatar?: string;
  image?: string;
  attendeeIds: string[];
  maybeIds: string[];
  capacity: number;
  tags?: Category[];
}

export interface UserProfile {
  id: string;
  name: string;
  bio: string;
  avatar: string;
  interests: Category[];
  joinedDate: string;
}

export interface Interest {
  id: string;
  label: string;
  icon: string;
}

export interface Comment {
  id: string;
  gatheringId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  timestamp: string; // ISO string
}
