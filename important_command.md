
// communicatie with ubuntu server using this command :


ssh -i .\k8s-master-key.pem ubuntu@16.170.126.193


### 12. redis-deployment.yaml

### Runs Redis container.

Cache

Sessions

Queues

Rate limiting





                 Internet
                     │
                     ▼
             NGINX Ingress
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
   Frontend Service         Backend Service
        │                         │
        ▼                         ▼
 Frontend Pods              Backend Pods
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
              PostgreSQL Service           Redis Service
                    │                             │
                    ▼                             ▼
             PostgreSQL Pod                Redis Pod
                                   │
                                   ▼
                              Worker Pod









####                         The same Node.js project contains both:

Express API
BullMQ Worker
Then why separate the worker?

#### Because they do different jobs.

Backend Pod

Runs:

node server.js

Responsibilities:

Authentication
URL shortening
Payment APIs
Subscription APIs
Analytics API
User requests
Worker Pod

Runs:

node worker.js

Responsibilities:

Process BullMQ jobs
Generate analytics
Send emails
Clean expired URLs
Handle background tasks

No HTTP server runs here















### 


EC2 Ubuntu (Single Kubernetes Node)
│
├── Frontend Pod 1
├── Frontend Pod 2
├── Backend Pod 1
├── Backend Pod 2
├── Worker Pod
├── PostgreSQL Pod
└── Redis Pod






















                                      ┌────────────────────────────────────────────┐
                                      │                 USER BROWSER               │
                                      │  https://snapurl.com                       │
                                      └────────────────────┬───────────────────────┘
                                                           │
                                                     HTTP/HTTPS
                                                           │
                                                           ▼
                                           AWS Security Group (80/443)
                                                           │
                                                           ▼
═══════════════════════════════════════════════════════════════════════════════════════════════
                         EC2 Ubuntu (Single Node = Control Plane + Worker)
═══════════════════════════════════════════════════════════════════════════════════════════════

                    ┌──────────────────────────────────────────────┐
                    │          NGINX Ingress Controller            │
                    │                 (Pod)                        │
                    └──────────────────┬───────────────────────────┘
                                       │
                                       ▼
                             Backend Service (ClusterIP)
                                       │
                  ┌────────────────────┴────────────────────┐
                  ▼                                         ▼
        Backend Pod 1                               Backend Pod 2
      (node server.js)                           (node server.js)
                  │                                         │
                  └────────────────────┬────────────────────┘
                                       │
                         ┌─────────────┴─────────────┐
                         ▼                           ▼
                  PostgreSQL Service          Redis Service
                         │                           │
                         ▼                           ▼
                 PostgreSQL Pod              Redis Pod
                                                     │
                                                     ▼
                                              Worker Pod
                                          (node worker.js)

═══════════════════════════════════════════════════════════════════════════════════════════════
                        Kubernetes Control Plane (same EC2)
═══════════════════════════════════════════════════════════════════════════════════════════════

                 kubectl
                    │
                    ▼
          ┌───────────────────────┐
          │ Kubernetes API Server │
          └───────────┬───────────┘
                      │
      ┌───────────────┼────────────────┐
      ▼               ▼                ▼
 Controller Manager  Scheduler       etcd
      │                                │
      │                                │
      └────────────── Stores Cluster State

═══════════════════════════════════════════════════════════════════════════════════════════════
                         Worker Node Components (same EC2)
═══════════════════════════════════════════════════════════════════════════════════════════════

        kubelet
            │
            ▼
      containerd
            │
            ▼
     Runs all containers

═══════════════════════════════════════════════════════════════════════════════════════════════
                             Networking
═══════════════════════════════════════════════════════════════════════════════════════════════

Calico CNI
      │
      ├── Gives every Pod its own IP
      ├── Connects Pods together
      ├── Enables Pod-to-Pod communication
      └── Handles Kubernetes networking

═══════════════════════════════════════════════════════════════════════════════════════════════