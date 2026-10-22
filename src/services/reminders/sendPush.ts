export async function sendPush(token: string, title: string, body: string, tripId?: string) {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ to: token, title, body, sound: 'default', data: { tripId } }),
  });
  const json = await response.json();
  if (json?.data?.status === 'error') throw new Error(json.data.message || 'Push failed');
}
