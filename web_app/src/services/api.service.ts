import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { defaultProductionBase, ensureServer, recoverAfterFailure } from './server-selector';
import {
  Chat,
  ChatParticipantProfile,
  ExtendedUserProfile,
  FavoriteItem,
  FeedPost,
  GoogleAuthResponse,
  LoginResponse,
  Message,
  NearbyUser,
  PaymentOutcome,
  PaymentSession,
  ProfileImage,
  Room,
  SignupResponse,
  UserProfile,
} from '../models/chat.models';

export type {
  Chat,
  ChatParticipantProfile,
  ExtendedUserProfile,
  FavoriteItem,
  FeedPost,
  GoogleAuthResponse,
  LoginResponse,
  Message,
  NearbyUser,
  PaymentOutcome,
  PaymentSession,
  ProfileImage,
  Room,
  SignupResponse,
  UserProfile,
};

// Where traffic goes before /health has proved anything. server-selector
// replaces this the moment it knows better, so a page load is never blocked
// waiting on a probe.
const initialBase =
  (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
  (import.meta.env.PROD ? defaultProductionBase : '/api');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ */
/* normalisation helpers (mirror the Dart fromJson methods)            */
/* ------------------------------------------------------------------ */

const str = (value: unknown): string =>
  value == null ? '' : typeof value === 'string' ? value : String(value);

function parseMillis(value: unknown): number {
  if (value == null) return Date.now();
  if (typeof value === 'number') return value > 1e12 ? value : value * 1000;
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (!Number.isNaN(numeric) && value.trim() !== '') {
      return numeric > 1e12 ? numeric : numeric * 1000;
    }
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
}

function cleanUrl(value: unknown): string | null {
  const url = str(value).trim();
  if (!url || url.includes('Portrait_Placeholder.png')) return null;
  return url;
}

const asArray = (value: unknown): any[] => (Array.isArray(value) ? value : []);

function normaliseProfileImage(raw: any): ProfileImage {
  return {
    id: str(raw?.id ?? raw?._id),
    url: str(raw?.url),
    thumbnailUrl: str(raw?.thumbnail_url ?? raw?.thumbnailUrl),
    isExclusive: Boolean(raw?.is_exclusive ?? raw?.isExclusive),
    price: Number(raw?.price ?? 0),
    currency: str(raw?.currency) || 'NGN',
    blurHash: str(raw?.blur_hash ?? raw?.blurHash),
    isUnlocked: raw?.is_unlocked ?? raw?.isUnlocked ?? true,
    createdAt: raw?.created_at ? parseMillis(raw.created_at) : undefined,
  };
}

function normaliseUserProfile(raw: any): UserProfile {
  const photos = asArray(raw?.photos)
    .map((entry) => str(entry))
    .filter((entry) => entry && !entry.includes('Portrait_Placeholder.png'));
  return {
    id: str(raw?.id ?? raw?._id),
    email: str(raw?.email),
    username: str(raw?.username),
    name: str(raw?.name) || str(raw?.email).split('@')[0] || 'User',
    avatar: cleanUrl(raw?.avatar),
    bio: str(raw?.bio),
    gender: str(raw?.gender) || 'Other',
    interestedIn: asArray(raw?.interestedIn).map(str),
    photos,
    status: str(raw?.status) || 'available',
    lastSeen: raw?.lastSeen ? parseMillis(raw.lastSeen) : undefined,
    birthDate: raw?.birthDate ? parseMillis(raw.birthDate) : undefined,
    age: raw?.age != null ? Number(raw.age) : undefined,
    referralCode: str(raw?.referralCode ?? raw?.referral_code),
    coverPhoto: cleanUrl(raw?.coverPhoto) ?? undefined,
    profileImages: asArray(raw?.profile_images).map(normaliseProfileImage),
    hasCompletedOnboarding:
      raw?.hasCompletedOnboarding ?? raw?.has_completed_onboarding ?? undefined,
    distance: raw?.distance != null ? str(raw.distance) : undefined,
  };
}

export function isImageContent(content?: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
        const first = parsed[0].toLowerCase();
        if (first.startsWith('http') || first.startsWith('data:image') || first.startsWith('blob:')) return true;
      }
    } catch {
      // not json array
    }
  }
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('data:image/') ||
    lower.startsWith('blob:')
  ) {
    if (
      lower.includes('cloudinary') ||
      lower.includes('/uploads/') ||
      lower.includes('content') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.gif') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.svg')
    ) {
      return true;
    }
  }
  return false;
}

function normalisePost(raw: any): FeedPost {
  const user = raw?.user ?? {};
  return {
    id: str(raw?.id ?? raw?._id),
    userId: str(user?.id ?? user?._id ?? user?.userId ?? raw?.userId ?? raw?.user_id),
    userName: str(user?.name ?? raw?.name) || 'User',
    userAvatar: cleanUrl(user?.avatar ?? raw?.avatar),
    userPhotos: asArray(user?.photos ?? raw?.photos).map(str),
    userStatus: str(user?.status ?? raw?.status),
    content: str(raw?.content),
    images: asArray(raw?.media).map(str),
    category: raw?.category != null ? str(raw.category) : null,
    distance: raw?.distance != null ? str(raw.distance) : null,
    createdAt: parseMillis(raw?.createdAt ?? raw?.created_at),
  };
}

function normaliseMessage(raw: any): Message {
  const reactions: Record<string, string> = {};
  if (raw?.reactions && typeof raw.reactions === 'object') {
    Object.entries(raw.reactions).forEach(([key, value]) => {
      reactions[key] = str(value);
    });
  }
  return {
    id: str(raw?._id ?? raw?.id),
    chatId: str(raw?.chatId),
    senderId: str(raw?.senderId ?? raw?.sender?._id ?? raw?.sender?.id),
    content: str(raw?.content),
    type: str(raw?.type) || 'text',
    createdAt: parseMillis(raw?.createdAt ?? raw?.created_at),
    isRead: raw?.isRead === true,
    reactions,
    replyToId: raw?.replyToId != null ? str(raw.replyToId) : undefined,
    replyToContent: raw?.replyToContent != null ? str(raw.replyToContent) : undefined,
    replyToSenderName:
      raw?.replyToSenderName != null ? str(raw.replyToSenderName) : undefined,
    senderName: str(raw?.senderName ?? raw?.sender?.name) || undefined,
    senderAvatar: cleanUrl(raw?.senderAvatar ?? raw?.sender?.avatar),
  };
}

function normaliseChat(raw: any): Chat {
  const partner = raw?.partner ?? {};
  const lastRaw = raw?.lastMessage;
  const lastMessage =
    lastRaw && typeof lastRaw === 'object' ? str(lastRaw.content) : str(lastRaw);

  const isGroup = raw?.isGroup === true;
  const partnerName = isGroup
    ? str(raw?.groupName) || 'Group Chat'
    : str(partner?.name) || str(partner?.email) || 'User';

  let avatar = isGroup
    ? cleanUrl(raw?.groupAvatar)
    : cleanUrl(partner?.avatar);

  const partnerPhotos = asArray(partner?.photos)
    .map(str)
    .filter((entry) => entry && !entry.includes('Portrait_Placeholder.png'));

  if (!avatar) {
    avatar = isGroup
      ? 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=600&h=600&q=80'
      : partnerPhotos[0] ?? null;
  }

  const participantsProfiles: ChatParticipantProfile[] = asArray(
    raw?.participantsProfiles
  ).map((entry: any) => ({
    id: str(entry?.id ?? entry?._id),
    name: str(entry?.name),
    avatar: cleanUrl(entry?.avatar),
    photos: asArray(entry?.photos).map(str),
    status: str(entry?.status) || 'offline',
    isOnline: entry?.isOnline === true,
  }));

  let partnerId = str(partner?.id ?? partner?._id);
  if (!partnerId && !isGroup && participantsProfiles.length > 0) {
    try {
      const myId = str(localStorage.getItem('userId') || sessionStorage.getItem('userId'));
      const other = participantsProfiles.find((p) => p.id && p.id !== myId);
      if (other) partnerId = other.id;
    } catch {
      // ignore
    }
  }

  const explicitType = (lastRaw && typeof lastRaw === 'object' ? lastRaw.type : undefined) || raw?.lastMessageType;
  const isImg = explicitType === 'image' || isImageContent(lastMessage);
  const lastMessageType = isImg ? 'image' : str(explicitType ?? 'text');

  return {
    id: str(raw?.id ?? raw?._id),
    partnerId,
    partnerName,
    partnerAvatar: avatar,
    partnerPhotos,
    lastMessage,
    lastMessageType,
    lastMessageTime: parseMillis(raw?.lastMessageAt ?? raw?.updatedAt),
    unreadCount: Number(raw?.unreadCount ?? 0),
    isOnline: partner?.isOnline === true,
    partnerStatus: str(partner?.status) || 'offline',
    isGroup,
    groupName: raw?.groupName != null ? str(raw.groupName) : undefined,
    groupAvatar: raw?.groupAvatar != null ? str(raw.groupAvatar) : undefined,
    groupDescription:
      raw?.groupDescription != null ? str(raw.groupDescription) : undefined,
    adminIds: asArray(raw?.adminIds).map(str),
    participants: asArray(raw?.participants)
      .map((entry) => str(entry?._id ?? entry?.id ?? entry))
      .filter(Boolean),
    participantsProfiles,
  };
}

function normaliseFavorite(raw: any): FavoriteItem {
  const user = raw?.user ?? raw?.target ?? {};
  return {
    id: str(raw?.id ?? raw?._id ?? user?.id ?? user?._id),
    targetUserId: str(
      raw?.targetUserId ?? raw?.userId ?? user?.id ?? user?._id ?? raw?.id ?? raw?._id
    ),
    name: str(user?.name ?? raw?.name) || 'User',
    avatar: cleanUrl(user?.avatar ?? raw?.avatar),
    photos: asArray(user?.photos ?? raw?.photos).map(str),
    status: str(user?.status ?? raw?.status) || 'offline',
    bio: str(user?.bio ?? raw?.bio),
    distance: raw?.distance != null
      ? str(raw.distance)
      : user?.distance != null
      ? str(user.distance)
      : undefined,
    createdAt: raw?.createdAt ? parseMillis(raw.createdAt) : undefined,
  };
}

function normaliseNearby(raw: any): NearbyUser {
  return {
    id: str(raw?.id ?? raw?._id),
    name: str(raw?.name) || str(raw?.email) || 'User',
    avatar: cleanUrl(raw?.avatar),
    photos: asArray(raw?.photos).map(str),
    status: str(raw?.status) || 'offline',
    bio: str(raw?.bio),
    distance: raw?.distance != null ? str(raw.distance) : undefined,
    age: raw?.age != null ? Number(raw.age) : undefined,
    isOnline: raw?.isOnline === true,
    gender: raw?.gender != null ? str(raw.gender) : undefined,
  };
}

function normaliseRoom(raw: any): Room {
  return {
    id: str(raw?.id ?? raw?._id),
    name: str(raw?.name),
    description: str(raw?.description),
    avatarUrl: str(raw?.avatar_url ?? raw?.avatarUrl),
    category: str(raw?.category),
    maxMembers: Number(raw?.max_members ?? 0),
    currentMembers: Number(raw?.current_members ?? 0),
    createdBy: str(raw?.created_by),
    isTrending: raw?.is_trending === true,
    tags: asArray(raw?.tags).map(str),
    isJoined: raw?.is_joined === true,
    isFull: raw?.is_full === true,
  };
}

function normaliseExtendedUser(raw: any): ExtendedUserProfile {
  const photos = asArray(raw?.photos)
    .map(str)
    .filter((entry) => entry && !entry.includes('Portrait_Placeholder.png'));
  const name =
    str(raw?.name) ||
    str(raw?.username) ||
    (raw?.email ? str(raw?.email).split('@')[0] : '') ||
    'User';
  return {
    id: str(raw?.id ?? raw?._id),
    name,
    username: raw?.username != null ? str(raw.username) : undefined,
    avatar: cleanUrl(raw?.avatar),
    bio: str(raw?.bio),
    gender: raw?.gender != null ? str(raw.gender) : undefined,
    interestedIn: asArray(raw?.interestedIn ?? raw?.interests).map(str),
    photos,
    status: str(raw?.status) || 'offline',
    birthDate: raw?.birthDate ? parseMillis(raw.birthDate) : undefined,
    age: raw?.age != null ? Number(raw.age) : undefined,
    lastSeen: raw?.lastSeen
      ? parseMillis(raw.lastSeen)
      : raw?.lastActive
      ? parseMillis(raw.lastActive)
      : undefined,
    distance: raw?.distance != null ? str(raw.distance) : undefined,
    isOnline: raw?.isOnline === true,
    profileImages: asArray(raw?.profile_images).map(normaliseProfileImage),
    rating: raw?.rating != null ? Number(raw.rating) : undefined,
    verified: raw?.verified === true,
    lastActive: raw?.lastActive
      ? parseMillis(raw.lastActive)
      : raw?.lastSeen
      ? parseMillis(raw.lastSeen)
      : undefined,
    interests: asArray(raw?.interests ?? raw?.interestedIn).map(str),
  };
}

/* ------------------------------------------------------------------ */
/* service                                                             */
/* ------------------------------------------------------------------ */

class ApiService {
  private axiosInstance: AxiosInstance;

  /** Always the host traffic is going to right now, not the build-time guess. */
  get baseUrl(): string {
    return this.axiosInstance.defaults.baseURL as string;
  }

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: initialBase,
      // Render free instances need time to wake from sleep.
      timeout: 45000,
      // No global Content-Type. A JSON default here silently converts every
      // FormData body into a JSON string (axios serialises it when it sees
      // application/json), so uploads send no file at all. Axios picks
      // application/json for object bodies and multipart for FormData per
      // request, which is what the Go handlers expect.
    });

    this.axiosInstance.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.expireSession(this.getToken(), error.config?.url);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Sign-in endpoints answer 401 for a wrong password, which is not a dead
   * session - clearing there would fight the form's own error message.
   */
  private static readonly signInPaths = ['/login', '/signup', '/google-auth', '/admin/login'];
  private expiredToken: string | null = null;

  /**
   * A rejected token used to leave the app half-signed-in: storage kept the
   * dead value, so the route guard believed the user was authenticated and
   * every screen replayed the same token until the console filled with 401s.
   * Dropping it here is what lets the guard bounce to the login screen.
   */
  private expireSession(token: string | null, url?: string): void {
    const path = (url || '').split('?')[0];
    if (ApiService.signInPaths.includes(path)) return;
    if (!token || token === this.expiredToken) return;
    this.expiredToken = token;
    this.removeToken();
    window.dispatchEvent(new Event('auth:expired'));
  }

  private async request<T>(
    config: AxiosRequestConfig,
    attempt = 0,
    retry = true
  ): Promise<T> {
    const server = await ensureServer();
    this.axiosInstance.defaults.baseURL = server.base;
    try {
      const response = await this.axiosInstance.request<T>(config);
      return response.data;
    } catch (error: any) {
      const status = error?.response?.status;
      const retryable =
        status === 502 || status === 503 || status === 504 || status === 429;
      const networkError = !error?.response;
      // Sending a code is not idempotent: a blind retry would email the user
      // again and burn the rate limit that protects the mailbox.
      if ((retryable || networkError) && retry && attempt < 2) {
        await sleep(1500 * (attempt + 1));
        // The first retry gives a sleeping instance more time; only a host that
        // has failed twice gets re-probed against the others.
        if (attempt >= 1) {
          const next = await recoverAfterFailure(server.base);
          if (next) this.axiosInstance.defaults.baseURL = next;
        }
        return this.request<T>(config, attempt + 1, retry);
      }
      // Anything else that failed the way a *host* fails rather than the way a
      // request does - a 5xx or no answer at all - gets the servers re-checked
      // in the background so the next call lands somewhere alive. The failed
      // call is never repeated here: a POST is not idempotent.
      if (networkError || (typeof status === 'number' && status >= 500)) {
        void recoverAfterFailure(server.base);
      }
      throw error;
    }
  }

  /* ----------------------------- auth ----------------------------- */

  async login(email: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>({
      url: '/login',
      method: 'POST',
      data: { email, password },
    });
  }

  async requestResetCode(email: string): Promise<{ message: string; expiresInSeconds: number }> {
    return this.request({ url: '/request-otp', method: 'POST', data: { email } }, 0, false);
  }

  async resetPasswordWithCode(data: {
    email: string;
    code: string;
    password: string;
  }): Promise<LoginResponse> {
    return this.request<LoginResponse>({ url: '/reset-password', method: 'POST', data }, 0, false);
  }

  async signup(userData: {
    email: string;
    password: string;
    name: string;
    gender: string;
    interestedIn: string[];
    birthDate?: number;
    avatar?: string;
    photos?: string[];
    bio?: string;
    status?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<SignupResponse> {
    return this.request<SignupResponse>({
      url: '/signup',
      method: 'POST',
      data: userData,
    });
  }

  async googleAuth(credential: string): Promise<GoogleAuthResponse> {
    return this.request<GoogleAuthResponse>({
      url: '/google-auth',
      method: 'POST',
      data: { credential },
    });
  }

  /* ---------------------------- profile --------------------------- */

  async getProfile(): Promise<UserProfile> {
    const raw = await this.request<any>({ url: '/me', method: 'GET' });
    return normaliseUserProfile(raw);
  }

  async updateProfile(data: Record<string, any>): Promise<UserProfile> {
    const raw = await this.request<any>({ url: '/me', method: 'PUT', data });
    return normaliseUserProfile(raw);
  }

  async updateUserStatus(status: string): Promise<void> {
    await this.request<unknown>({ url: '/me', method: 'PUT', data: { status } });
  }

  async updateLocation(latitude: number, longitude: number): Promise<void> {
    await this.request<unknown>({
      url: '/me',
      method: 'PUT',
      data: { latitude, longitude },
    });
  }

  async deleteAccount(): Promise<boolean> {
    try {
      await this.request<unknown>({ url: '/me', method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }

  async blockUser(userId: string): Promise<void> {
    await this.request<unknown>({
      url: '/block',
      method: 'POST',
      data: { targetUserId: userId },
    });
  }

  /* ---------------------------- uploads --------------------------- */

  private async uploadFile(
    url: string,
    file: File,
    field = 'photo'
  ): Promise<any> {
    const formData = new FormData();
    formData.append(field, file, file.name || 'photo.jpg');
    // No explicit Content-Type: the browser must generate
    // "multipart/form-data; boundary=..." itself. Setting it by hand drops the
    // boundary and the Go handler answers 400 "Failed to parse form data".
    return this.request<any>({
      url,
      method: 'POST',
      data: formData,
    });
  }

  /** POST /upload-photo — returns the uploaded URL (null on failure). */
  async uploadImage(file: File): Promise<string | null> {
    try {
      const result = await this.uploadFile('/upload-photo', file);
      return str(result?.url) || null;
    } catch {
      return null;
    }
  }

  async uploadProfileImage(file: File): Promise<ProfileImage | null> {
    try {
      const result = await this.uploadFile('/users/me/images', file);
      const candidate = result?.image ?? result?.profile_image ?? result;
      return candidate ? normaliseProfileImage(candidate) : null;
    } catch {
      return null;
    }
  }

  async updateProfileImage(
    imageId: string,
    isExclusive: boolean,
    price: number,
    currency = 'NGN'
  ): Promise<void> {
    await this.request<unknown>({
      url: `/users/me/images/${imageId}`,
      method: 'PATCH',
      data: { is_exclusive: isExclusive, price, currency },
    });
  }

  async deleteProfileImage(imageId: string): Promise<void> {
    await this.request<unknown>({
      url: `/users/me/images/${imageId}`,
      method: 'DELETE',
    });
  }

  /* ----------------------------- feed ----------------------------- */

  async getFeed(): Promise<FeedPost[]> {
    const data = await this.request<any>({ url: '/feed', method: 'GET' });
    const list = Array.isArray(data) ? data : data?.posts ?? [];
    return list.map(normalisePost);
  }

  async createPost(data: {
    content: string;
    media?: string[];
    category?: string;
    /** Sent by the Flutter client too; the Go API ignores it for now. */
    duration?: number;
    latitude?: number;
    longitude?: number;
  }): Promise<{ message?: string; postId?: string }> {
    return this.request<{ message?: string; postId?: string }>({
      url: '/post',
      method: 'POST',
      data,
    });
  }

  async getMyPosts(): Promise<FeedPost[]> {
    const data = await this.request<any>({ url: '/my/posts', method: 'GET' });
    const list = Array.isArray(data) ? data : data?.posts ?? [];
    return list.map(normalisePost);
  }

  /* ---------------------------- nearby ---------------------------- */

  /**
   * Omitted coordinates make the backend rank from the position stored on the
   * profile. Passing `0, 0` instead would ask it to measure from the Atlantic
   * off Ghana, and every row would come back labelled "Nearby".
   */
  async getNearbyUsers(lat?: number, lng?: number): Promise<NearbyUser[]> {
    const data = await this.request<any>({
      url: '/users/nearby',
      method: 'GET',
      params: lat != null && lng != null ? { lat, lng } : undefined,
    });
    const list = Array.isArray(data) ? data : data?.users ?? [];
    return list.map(normaliseNearby);
  }

  async searchUsers(query: string): Promise<NearbyUser[]> {
    const data = await this.request<any>({
      url: '/users/search',
      method: 'GET',
      params: { q: query },
    });
    const list = Array.isArray(data) ? data : data?.users ?? [];
    return list.map(normaliseNearby);
  }

  /* ---------------------------- chats ----------------------------- */

  async getChats(): Promise<Chat[]> {
    const data = await this.request<any>({ url: '/chats', method: 'GET' });
    const list = Array.isArray(data) ? data : data?.chats ?? [];
    return list.map(normaliseChat);
  }

  async createGroupChat(
    userIds: string[],
    groupName: string,
    options?: { groupDescription?: string; groupAvatar?: string }
  ): Promise<Chat> {
    return this.createGroup({
      participants: userIds,
      groupName,
      groupDescription: options?.groupDescription,
      groupAvatar: options?.groupAvatar,
    });
  }

  async getReferralInfo(): Promise<{ referralCode: string; referralUrl: string }> {
    try {
      const res = await this.request<{ referralCode?: string; referralUrl?: string }>({
        url: '/me/referral',
        method: 'GET',
      });
      if (res?.referralCode) {
        return {
          referralCode: res.referralCode,
          referralUrl: res.referralUrl || `https://zukaping.app/join?ref=${res.referralCode}`,
        };
      }
    } catch {
      // Fallback
    }
    const profile = await this.getProfile().catch(() => null);
    const code = (profile as any)?.referralCode || 'ZUKAPING';
    return {
      referralCode: code,
      referralUrl: `https://zukaping.app/join?ref=${code}`,
    };
  }

  /**
   * POST /reports. The moderator queue keys every flag by targetType/targetId,
   * and a rejected report used to be swallowed here so the UI could always show
   * "Reported" - the report was silently never filed.
   */
  async reportUser(userId: string, reason: string, details?: string): Promise<boolean> {
    await this.request<unknown>({
      url: '/reports',
      method: 'POST',
      data: { targetType: 'user', targetId: userId, reason, details: details ?? '' },
    });
    return true;
  }

  async createChat(userId: string): Promise<Chat> {
    const raw = await this.request<any>({
      url: '/chats',
      method: 'POST',
      data: { participants: [userId] },
    });
    return normaliseChat(raw);
  }

  /** Favourites screen posts `{ targetUserId }` with `participants` fallback. */
  async createChatByTarget(targetUserId: string): Promise<Chat> {
    const raw = await this.request<any>({
      url: '/chats',
      method: 'POST',
      data: { targetUserId, participants: [targetUserId] },
    });
    return normaliseChat(raw);
  }

  async createGroup(data: {
    participants: string[];
    groupName: string;
    groupDescription?: string;
    groupAvatar?: string;
  }): Promise<Chat> {
    const raw = await this.request<any>({
      url: '/chats',
      method: 'POST',
      data: { ...data, isGroup: true },
    });
    return normaliseChat(raw);
  }

  async getChat(chatId: string): Promise<Chat> {
    const raw = await this.request<any>({ url: `/chats/${chatId}`, method: 'GET' });
    return normaliseChat(raw);
  }

  async getMessages(chatId: string): Promise<Message[]> {
    const data = await this.request<any>({
      url: `/messages/${chatId}`,
      method: 'GET',
    });
    const list = Array.isArray(data) ? data : data?.messages ?? [];
    return list.map(normaliseMessage).sort((a, b) => a.createdAt - b.createdAt);
  }

  async sendMessage(data: {
    chatId: string;
    content: string;
    type?: string;
    replyToId?: string;
    replyToContent?: string;
    replyToSenderName?: string;
  }): Promise<Message> {
    const raw = await this.request<any>({
      url: '/message',
      method: 'POST',
      data: { ...data, type: data.type ?? 'text' },
    });
    return normaliseMessage(raw);
  }

  async reactToMessage(messageId: string, emoji: string): Promise<boolean> {
    try {
      await this.request<unknown>({
        url: `/messages/${messageId}/react`,
        method: 'POST',
        data: { emoji },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * The API clears every unread message in a chat when given any message id
   * from that chat, so the newest incoming id is enough.
   */
  async markAsRead(messageId: string): Promise<number> {
    try {
      const res = await this.request<any>({
        url: `/messages/${messageId}/read`,
        method: 'POST',
      });
      return Number(res?.updatedCount ?? 0);
    } catch {
      return 0;
    }
  }

  async updateGroup(
    chatId: string,
    data: { groupName?: string; groupDescription?: string; groupAvatar?: string }
  ): Promise<Chat> {
    const raw = await this.request<any>({
      url: `/chats/${chatId}`,
      method: 'PUT',
      data,
    });
    return normaliseChat(raw);
  }

  async promoteToAdmin(chatId: string, targetUserId: string): Promise<void> {
    await this.request<unknown>({
      url: `/chats/${chatId}/admin`,
      method: 'POST',
      data: { targetUserId },
    });
  }

  async removeGroupMember(chatId: string, userId: string): Promise<void> {
    await this.request<unknown>({
      url: `/chats/${chatId}/participants/${userId}`,
      method: 'DELETE',
    });
  }

  async addGroupMember(chatId: string, userId: string): Promise<void> {
    await this.request<unknown>({
      url: `/chats/${chatId}/participants`,
      method: 'POST',
      data: { userId },
    });
  }

  async generateGroupInviteCode(chatId: string): Promise<string> {
    const data = await this.request<any>({
      url: `/chats/${chatId}/invite`,
      method: 'POST',
    });
    return str(data?.inviteCode ?? data?.invite_code ?? data?.code);
  }

  async getGroupInfoByInviteCode(code: string): Promise<Chat> {
    const raw = await this.request<any>({
      url: `/groups/invite/${code}`,
      method: 'GET',
    });
    return normaliseChat(raw);
  }

  async joinGroupByInviteCode(code: string): Promise<Chat> {
    const raw = await this.request<any>({
      url: '/groups/join',
      method: 'POST',
      data: { inviteCode: code },
    });
    return normaliseChat(raw);
  }

  /* --------------------------- favorites -------------------------- */

  async getFavorites(): Promise<FavoriteItem[]> {
    const data = await this.request<any>({ url: '/favorites', method: 'GET' });
    const list = Array.isArray(data) ? data : data?.favorites ?? [];
    return list.map(normaliseFavorite);
  }

  async addFavorite(targetUserId: string): Promise<void> {
    await this.request<unknown>({
      url: '/favorite',
      method: 'POST',
      data: { targetUserId },
    });
  }

  async removeFavorite(targetUserId: string): Promise<void> {
    await this.request<unknown>({
      url: '/favorite',
      method: 'DELETE',
      params: { targetUserId },
    });
  }

  async toggleFavorite(targetUserId: string, currentlyFavorited: boolean): Promise<boolean> {
    if (currentlyFavorited) {
      await this.removeFavorite(targetUserId);
      return false;
    }
    await this.addFavorite(targetUserId);
    return true;
  }

  /* ----------------------------- rooms ---------------------------- */

  async getRooms(params?: { category?: string; trending?: boolean }): Promise<Room[]> {
    const data = await this.request<any>({
      url: '/rooms',
      method: 'GET',
      params: {
        ...(params?.category ? { category: params.category } : {}),
        ...(params?.trending ? { trending: 'true' } : {}),
      },
    });
    const list = Array.isArray(data) ? data : data?.rooms ?? [];
    return list.map(normaliseRoom);
  }

  async getRoomDetails(roomId: string): Promise<any> {
    return this.request<any>({ url: `/rooms/${roomId}`, method: 'GET' });
  }

  async joinRoom(roomId: string): Promise<any> {
    return this.request<any>({
      url: `/rooms/${roomId}/join`,
      method: 'POST',
      data: {},
    });
  }

  async leaveRoom(roomId: string): Promise<any> {
    return this.request<any>({
      url: `/rooms/${roomId}/leave`,
      method: 'DELETE',
    });
  }

  /* ------------------------- exclusive content -------------------- */

  async getUserProfile(userId: string): Promise<ExtendedUserProfile> {
    const raw = await this.request<any>({
      url: `/users/${userId}/profile`,
      method: 'GET',
    });
    return normaliseExtendedUser(raw);
  }

  async checkUnlockStatus(imageId: string): Promise<boolean> {
    try {
      const data = await this.request<any>({
        url: `/content/${imageId}/status`,
        method: 'GET',
      });
      return data?.unlocked === true;
    } catch {
      return false;
    }
  }

  /* --------------------------- payments ---------------------------- */

  /** Opens a Seerbit charge. The caller must navigate to redirectUrl to pay. */
  async initiatePayment(imageId: string): Promise<PaymentSession> {
    return this.request<PaymentSession>({
      url: '/payments/init',
      method: 'POST',
      data: { imageId },
    });
  }

  /** Asks the backend what the gateway says about a reference it issued. */
  async getPaymentStatus(reference: string): Promise<PaymentOutcome> {
    return this.request<PaymentOutcome>({
      url: `/payments/status/${encodeURIComponent(reference)}`,
      method: 'GET',
    });
  }

  /** Settles anything paid while this tab was closed. */
  async reconcilePayments(): Promise<{ checked: number; settled: number }> {
    return this.request<{ checked: number; settled: number }>({
      url: '/payments/reconcile',
      method: 'POST',
      data: {},
    });
  }

  /* ---------------------- push notifications ---------------------- */

  async subscribePush(subscription: any): Promise<void> {
    await this.request<unknown>({
      url: '/subscribe',
      method: 'POST',
      data: subscription,
    });
  }

  async getVapidPublicKey(): Promise<{ publicKey: string }> {
    return this.request<{ publicKey: string }>({
      url: '/vapid-public-key',
      method: 'GET',
    });
  }

  /* ---------------------- token management ------------------------ */

  private getToken(): string | null {
    try {
      return localStorage.getItem('token') || sessionStorage.getItem('token') || null;
    } catch {
      return null;
    }
  }

  setToken(token: string): void {
    try {
      localStorage.setItem('token', token);
      sessionStorage.setItem('token', token);
    } catch {
      /* ignore */
    }
  }

  removeToken(): void {
    try {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
    } catch {
      /* ignore */
    }
  }

  getCurrentToken(): string | null {
    return this.getToken();
  }
}

export const apiService = new ApiService();
