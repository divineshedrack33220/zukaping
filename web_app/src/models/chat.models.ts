/** Models mirroring mobile_app/lib/models/*.dart. */

export interface ProfileImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  isExclusive: boolean;
  price: number;
  currency: string;
  blurHash?: string;
  isUnlocked: boolean;
  createdAt?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  username?: string;
  name: string;
  avatar: string | null;
  bio?: string;
  gender: string;
  interestedIn: string[];
  photos: string[];
  status: string;
  lastSeen?: number;
  birthDate?: number;
  age?: number;
  referralCode?: string;
  coverPhoto?: string;
  profileImages: ProfileImage[];
  hasCompletedOnboarding?: boolean;
  distance?: string;
}

export interface FeedPost {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  userPhotos: string[];
  userStatus: string;
  content: string;
  images: string[];
  category?: string | null;
  distance?: string | null;
  createdAt: number;
}

export interface NearbyUser {
  id: string;
  name: string;
  avatar: string | null;
  photos: string[];
  status: string;
  bio?: string;
  distance?: string;
  age?: number;
  isOnline?: boolean;
  gender?: string;
}

export interface Message {
  id: string;
  chatId?: string;
  senderId: string;
  content: string;
  type: string;
  createdAt: number;
  isRead: boolean;
  reactions: Record<string, string>;
  replyToId?: string;
  replyToContent?: string;
  replyToSenderName?: string;
  senderName?: string;
  senderAvatar?: string | null;
}

export interface ChatParticipantProfile {
  id: string;
  name: string;
  avatar: string | null;
  photos: string[];
  status: string;
  isOnline?: boolean;
}

export interface Chat {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  partnerPhotos: string[];
  lastMessage: string;
  lastMessageType: string;
  lastMessageTime: number;
  unreadCount: number;
  isOnline: boolean;
  partnerStatus: string;
  isGroup: boolean;
  groupName?: string;
  groupAvatar?: string;
  groupDescription?: string;
  adminIds: string[];
  participants: string[];
  participantsProfiles: ChatParticipantProfile[];
}

export interface FavoriteItem {
  id: string;
  targetUserId: string;
  name: string;
  avatar: string | null;
  photos: string[];
  status: string;
  bio?: string;
  distance?: string;
  createdAt?: number;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  avatarUrl: string;
  category: string;
  maxMembers: number;
  currentMembers: number;
  createdBy: string;
  isTrending: boolean;
  tags: string[];
  isJoined: boolean;
  isFull: boolean;
}

export interface ExtendedUserProfile {
  id: string;
  name: string;
  username?: string;
  avatar: string | null;
  bio?: string;
  gender?: string;
  interestedIn?: string[];
  photos: string[];
  status?: string;
  birthDate?: number;
  age?: number;
  lastSeen?: number;
  distance?: string;
  isOnline?: boolean;
  profileImages: ProfileImage[];
  rating?: number;
  verified?: boolean;
  lastActive?: number;
  interests?: string[];
}

export interface LoginResponse {
  token: string;
  userId: string;
  email: string;
  username?: string;
  avatar?: string;
  name?: string;
  expires?: number;
  refreshToken?: string;
}

export interface SignupResponse {
  message?: string;
  token: string;
  userId: string;
  email?: string;
  username?: string;
  avatar?: string;
  refreshToken?: string;
}

export interface GoogleAuthResponse {
  token: string;
  userId: string;
  email: string;
  username?: string;
  avatar?: string;
  name?: string;
  isNewUser: boolean;
  hasCompletedOnboarding?: boolean;
  expires?: number;
  refreshToken?: string;
}

/** A charge we have opened on Seerbit but not yet seen the outcome of. */
export interface PaymentSession {
  status: string;
  reference?: string;
  redirectUrl?: string;
  amount?: number;
  currency?: string;
  unlocked?: boolean;
}

/** What the gateway says about a reference we asked it about. */
export interface PaymentOutcome {
  status: string;
  unlocked: boolean;
  reference: string;
}
