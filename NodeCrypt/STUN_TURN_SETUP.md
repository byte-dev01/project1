# Setting Up Your Own STUN/TURN Server

## Option 1: Using Coturn (Recommended)

### Prerequisites
- A VPS or dedicated server with a public IP address
- Ubuntu/Debian Linux (or Windows with WSL2)
- Ports 3478 (STUN/TURN) and 5349 (TURN over TLS) open
- A domain name (optional but recommended for TLS)

### Step 1: Install Coturn

#### On Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install coturn
```

#### On Windows (using WSL2):
```bash
# Install WSL2 first, then Ubuntu
wsl --install -d Ubuntu
# Inside WSL2:
sudo apt-get update
sudo apt-get install coturn
```

#### Using Docker (Easiest for Testing):
```bash
docker pull coturn/coturn
```

### Step 2: Configure Coturn

Create/edit the configuration file:
```bash
sudo nano /etc/turnserver.conf
```

Add this configuration:
```conf
# STUN/TURN server configuration for NodeCrypt

# Network settings
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
relay-ip=YOUR_SERVER_PUBLIC_IP
external-ip=YOUR_SERVER_PUBLIC_IP

# Authentication
realm=nodecrypt.yourdomain.com
# Generate these with: openssl rand -hex 32
auth-secret=your-super-secret-key-here

# Security settings
fingerprint
no-multicast-peers
no-cli
no-tlsv1
no-tlsv1_1

# Logging
log-file=/var/log/coturn/turnserver.log
verbose

# Performance
min-port=49152
max-port=65535
user-quota=100
total-quota=1000

# For HIPAA compliance - don't log packet contents
no-stdout-log
simple-log

# Rate limiting
max-bps=1000000  # 1 Mbps per user
bps-capacity=10000000  # 10 Mbps total
```

### Step 3: SSL/TLS Setup (Required for Production)

Generate SSL certificates:
```bash
# Using Let's Encrypt (recommended)
sudo apt-get install certbot
sudo certbot certonly --standalone -d turn.yourdomain.com

# Add to turnserver.conf:
cert=/etc/letsencrypt/live/turn.yourdomain.com/fullchain.pem
pkey=/etc/letsencrypt/live/turn.yourdomain.com/privkey.pem
```

### Step 4: Start the TURN Server

```bash
# Enable coturn to start on boot
sudo systemctl enable coturn

# Start the service
sudo systemctl start coturn

# Check status
sudo systemctl status coturn

# View logs
sudo tail -f /var/log/coturn/turnserver.log
```

### Step 5: Update NodeCrypt WebRTC Configuration

Edit your `webrtc-integration.js`:

```javascript
class WebRTCManager {
    constructor() {
        // ... existing code ...
        
        // Update with your TURN server
        this.configuration = {
            iceServers: [
                {
                    urls: 'stun:turn.yourdomain.com:3478'
                },
                {
                    urls: 'turn:turn.yourdomain.com:3478',
                    username: 'turnuser',
                    credential: this.generateTurnCredentials()
                },
                {
                    urls: 'turns:turn.yourdomain.com:5349',  // TLS
                    username: 'turnuser',
                    credential: this.generateTurnCredentials()
                }
            ],
            iceTransportPolicy: 'all',  // or 'relay' to force TURN
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };
    }
    
    // Generate time-limited TURN credentials
    generateTurnCredentials() {
        const username = `${Date.now()}:webrtc_user`;
        const secret = 'your-super-secret-key-here';  // Same as in turnserver.conf
        
        // In production, generate this on the server
        const credential = this.createHmacSha1(username, secret);
        return credential;
    }
    
    createHmacSha1(username, secret) {
        // Use crypto-js or similar library
        // This is a simplified example
        return btoa(username + ':' + secret);
    }
}
```

## Option 2: Quick Docker Setup (For Testing)

Create `docker-compose.yml`:

```yaml
version: '3'

services:
  coturn:
    image: coturn/coturn
    container_name: nodecrypt-turn
    ports:
      - "3478:3478/udp"
      - "3478:3478/tcp"
      - "5349:5349/udp"
      - "5349:5349/tcp"
      - "49152-65535:49152-65535/udp"
    environment:
      - DETECT_EXTERNAL_IP=yes
      - DETECT_RELAY_IP=yes
      - LISTENING_PORT=3478
      - TLS_LISTENING_PORT=5349
      - MIN_PORT=49152
      - MAX_PORT=65535
      - REALM=nodecrypt.local
      - AUTH_SECRET=your-secret-key
      - LOG_LEVEL=verbose
    volumes:
      - ./coturn/data:/var/lib/coturn
      - ./coturn/logs:/var/log/coturn
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

## Option 3: Cloud Providers (Managed Solutions)

### Twilio TURN (Easiest but Costs Money)
```javascript
// Get credentials from Twilio
fetch('https://api.twilio.com/stun-turn-token')
    .then(response => response.json())
    .then(data => {
        this.configuration = {
            iceServers: data.ice_servers
        };
    });
```

### Xirsys (Free Tier Available)
```javascript
// Sign up at xirsys.com
const xirsysConfig = {
    iceServers: [
        {
            urls: "stun:stun.xirsys.com"
        },
        {
            username: "your-xirsys-username",
            credential: "your-xirsys-credential",
            urls: [
                "turn:turn.xirsys.com:80?transport=udp",
                "turn:turn.xirsys.com:3478?transport=udp",
                "turns:turn.xirsys.com:443?transport=tcp"
            ]
        }
    ]
};
```

## Testing Your STUN/TURN Server

### 1. Test STUN Functionality
```javascript
// In browser console
const pc = new RTCPeerConnection({
    iceServers: [{
        urls: 'stun:your-server:3478'
    }]
});

pc.createDataChannel('test');
pc.createOffer().then(offer => pc.setLocalDescription(offer));

pc.onicecandidate = (event) => {
    if (event.candidate) {
        console.log('STUN working:', event.candidate);
    }
};
```

### 2. Test TURN Relay
```javascript
// Force TURN relay only
const pc = new RTCPeerConnection({
    iceServers: [{
        urls: 'turn:your-server:3478',
        username: 'test',
        credential: 'test'
    }],
    iceTransportPolicy: 'relay'  // Forces TURN
});
```

### 3. Using Online Tester
Visit: https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/

Enter your STUN/TURN server details and test.

## Security Best Practices

### 1. Firewall Rules
```bash
# Allow only necessary ports
sudo ufw allow 3478/tcp
sudo ufw allow 3478/udp
sudo ufw allow 5349/tcp
sudo ufw allow 5349/udp
sudo ufw allow 49152:65535/udp
```

### 2. Rate Limiting
```conf
# In turnserver.conf
max-allocate-lifetime=3600
max-allocate-timeout=10
stale-nonce=600
max-bps=1000000  # 1 Mbps per user
```

### 3. Monitoring
```bash
# Monitor TURN usage
sudo turnutils_uclient -p 3478 your-server-ip

# Check active connections
sudo turnadmin -p 5766 -k -l
```

### 4. HIPAA Compliance
- Don't log packet contents
- Use TLS for signaling
- Implement access controls
- Regular security audits
- Sign BAA if using managed service

## Troubleshooting

### Common Issues:

1. **Port Blocked**
   ```bash
   # Test if port is open
   nc -zv your-server-ip 3478
   ```

2. **NAT Issues**
   ```conf
   # Add to turnserver.conf
   external-ip=YOUR_PUBLIC_IP/YOUR_PRIVATE_IP
   ```

3. **Certificate Issues**
   ```bash
   # Check certificate
   openssl s_client -connect your-server:5349
   ```

4. **Authentication Failures**
   ```bash
   # Test with static credentials first
   user=testuser:testpass
   ```

## Cost Comparison

| Solution | Cost | Pros | Cons |
|----------|------|------|------|
| Self-hosted Coturn | $5-20/month (VPS) | Full control, HIPAA compliant | Maintenance required |
| Twilio | $0.40/GB | Managed, reliable | Expensive at scale |
| Xirsys | Free-$95/month | Free tier, good docs | Limited free bandwidth |
| Google STUN | Free | No setup | No TURN, privacy concerns |

## For NodeCrypt Production

### Recommended Setup:
1. **Primary**: Self-hosted Coturn on dedicated VPS
2. **Backup**: Xirsys or Twilio as fallback
3. **Configuration**: Mix of STUN and TURN servers

```javascript
iceServers: [
    // Your STUN server
    { urls: 'stun:turn.yourdomain.com:3478' },
    
    // Your TURN server
    {
        urls: 'turn:turn.yourdomain.com:3478',
        username: generateUsername(),
        credential: generateCredential()
    },
    
    // Fallback public STUN (optional)
    { urls: 'stun:stun.l.google.com:19302' }
]
```

## Next Steps

1. Set up Coturn on a VPS
2. Configure SSL certificates
3. Update NodeCrypt configuration
4. Test with https://test.webrtc.org
5. Monitor usage and performance
6. Implement credential rotation