export interface FriendProfile {
  id: string;
  fullname: string;
  email: string;
  photoURL?: string;
  currency?: string;
}

export interface UserSearchResult {
  id: string;
  fullname: string;
  email: string;
  photoURL?: string;
}

/**
 * One friendship request, from the person who sent it to the person who has to
 * answer. The same record is stored twice - in the receiver's inbox and in the
 * sender's outbox - so both sides can show it without reading each other's data.
 */
export interface FriendRequest {
  fromId: string;
  fromName: string;
  fromEmail: string;
  fromPhotoURL?: string;
  toId: string;
  toName: string;
  toEmail: string;
  toPhotoURL?: string;
  createdAt: string;
}
