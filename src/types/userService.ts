type UserProfileUpdate = Partial<{
  email: string;
  displayName: string;
  photoURL: string;
  [key: string]: any;
}>;

export type AuthProfileUpdate = Partial<{
  displayName: string;
  photoURL: string;
  email: string;
}>;

export default UserProfileUpdate;