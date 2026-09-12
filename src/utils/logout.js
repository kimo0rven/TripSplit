import { deleteToken } from '../utils/secureStorage';

export async function handleLogout() {
  await deleteToken();
  router.push('/auth/login');
}