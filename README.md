# capacitor-posthog

Capacitor plugin for PostHog

## Install

```bash
npm install capacitor-posthog @posthog/core @capacitor/app @capacitor/device @capacitor/preferences
npx cap sync
```

## Usage

```typescript
import { PostHog } from 'capacitor-posthog';

// Create PostHog instance
const posthog = new PostHog();

// Initialize with setup method (required)
await posthog.setup('your-api-key', {
  host: 'https://app.posthog.com',
  enableSessionReplay: true, // Session replay starts automatically
  sessionReplayConfig: {
    maskAllTextInputs: true,
    maskAllImages: false
  },
  captureAppLifecycleEvents: true
});

// Track an event
await posthog.capture('button_clicked', {
  button_name: 'signup'
});

// Identify user
await posthog.identify('user_123', {
  email: 'user@example.com'
});
```

### Angular Example

```typescript
// posthog.service.ts
@Injectable({
  providedIn: 'root'
})
export class PosthogService {
  private posthog = new PostHog();

  async init() {
    await this.posthog.setup(environment.posthogApiKey, {
      host: environment.posthogHost,
      enableSessionReplay: true
    });
  }

  capture(event: string, properties?: any) {
    return this.posthog.capture(event, properties);
  }
}
```

### Vue/React Example

```typescript
// posthog.ts
export const posthog = new PostHog();

// In your app initialization
async function initializeApp() {
  await posthog.setup(process.env.POSTHOG_API_KEY, {
    host: process.env.POSTHOG_HOST,
    enableSessionReplay: true
  });
}

// Methods will wait gracefully if called before setup
posthog.capture('app_loaded'); // ✅ Waits for setup completion
```
