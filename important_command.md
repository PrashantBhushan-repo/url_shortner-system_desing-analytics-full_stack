
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









production sytle : 


Browser
     │
http://pburls.com
     │
     ▼
AWS Application Load Balancer
Listener :80 / :443
     │
     ▼
Target Group
     │
     ▼
EC2-1 :32637
EC2-2 :32637
EC2-3 :32637
     │
     ▼
Ingress Controller
     │
     ▼
Application




current archetuere : 






                       Browser
                          │
          http://16.170.xxx.xxx:32637
             (or pburls.com:32637)
                          │
                          ▼
                    Internet
                          │
                          ▼
                 AWS Security Group
              Allow TCP Port 32637
                          │
                          ▼
                 EC2 (Single Node)
               Ubuntu + Kubernetes
                          │
                          ▼
              NodePort :32637
                          │
                          ▼
              kube-proxy + iptables
                          │
                          ▼
        ingress-nginx-controller Service
                  ClusterIP :80
                          │
                          ▼
         Ingress Controller Pod :80
                          │
            ┌─────────────┴─────────────┐
            ▼                           ▼
     frontend-service              backend-service
      ClusterIP :80               ClusterIP :5000
            │                           │
            ▼                           ▼
     Frontend Pod                 Backend Pod
                                      │
                     ┌────────────────┴──────────────┐
                     ▼                               ▼
              postgres-service                redis-service
                    :5432                         :6379
                     │                              │
                     ▼                              ▼
              PostgreSQL Pod                  Redis Pod






// want to acheive indusriral archeture :




                       Browser
                          │
                 http://pburls.com
                          │
                          ▼
                    DNS (Route53)
                          │
                          ▼
             AWS Application Load Balancer
                 Listener :80 / :443
                          │
                          ▼
                  Target Group
                          │
                          ▼
                  EC2 :32637
                          │
                          ▼
                  NodePort :32637
                          │
                          ▼
              kube-proxy + iptables
                          │
                          ▼
         ingress-nginx-controller
                Service :80
                          │
                          ▼
         Ingress Controller Pod :80
                          │
           ┌──────────────┴──────────────┐
           ▼                             ▼
     frontend-service             backend-service
     ClusterIP :80              ClusterIP :5000
           │                             │
           ▼                             ▼
     Frontend Pod                  Backend Pod























     finally :


     Browser
    │
http://pburls.com
    │
    ▼
Application Load Balancer
Listener :80
    │
    ▼
Target Group
snapurl-nodeport
    │
    ▼
EC2
NodePort :32637
    │
    ▼
Ingress Controller
    │
    ▼
Application







                  INTERNET
                      │
        ┌─────────────┴─────────────┐
        │                           │
     HTTP:80                    HTTPS:443
        │                           │
        ▼                           ▼
+----------------------------------------------+
|        Security Group (snapurl-alb-sg)       |
|                                              |
|  Inbound:                                   |
|   ✔ TCP 80  ← 0.0.0.0/0                     |
|   ✔ TCP 443 ← 0.0.0.0/0                     |
|                                              |
|  Outbound:                                  |
|   ✔ All Traffic → 0.0.0.0/0                 |
+---------------------┬------------------------+
                      │
                      ▼
          AWS Application Load Balancer
                      │
                      ▼
            Target Group (32637)
                      │
                      ▼
             EC2 (k8s-master)
                      │
                      ▼
           NodePort :32637
                      │
                      ▼
            Ingress Controller
                      │
                      ▼
          Frontend / Backend Pods










                   Users Worldwide
                         │
                         ▼
                   pburls.com
                         │
                         ▼
                Route 53 (Global DNS)
                         │
      ┌──────────────────┼──────────────────┐
      ▼                  ▼                  ▼
  India Cluster      Europe Cluster     USA Cluster
 (Mumbai)            (Frankfurt)        (Virginia)
      │                  │                  │
      ▼                  ▼                  ▼
 AWS Load Balancer  AWS Load Balancer  AWS Load Balancer
      │                  │                  │
      ▼                  ▼                  ▼
 Ingress NGINX      Ingress NGINX      Ingress NGINX
      │                  │                  │
      ▼                  ▼                  ▼
 Frontend Service   Frontend Service   Frontend Service
 Backend Service    Backend Service    Backend Service
      │                  │                  │
      ▼                  ▼                  ▼
 Multiple Pods      Multiple Pods      Multiple Pods
      │                  │                  │
      └──────────────┬──────────────────────┘
                     ▼
             PostgreSQL (HA/Managed)
                     │
                     ▼
               Redis Cluster
                     │
                     ▼
                Amazon S3 Storage
                     │
                     ▼
              CloudFront CDN




              




#### security group concept:




                     Internet
                          │
                   HTTP 80 / HTTPS 443
                          │
                          ▼
         +--------------------------------+
         |  ALB Security Group            |
         |  Allow: 80, 443 from Internet  |
         +---------------┬----------------+
                         │
                         ▼
          AWS Application Load Balancer
                         │
                    Forward to
                         │
                         ▼
                 Target Group
                         │
                 EC2 :32637
                         │
                         ▼
      +--------------------------------------+
      | EC2 Security Group                   |
      | Allow TCP 32637                      |
      | Source = ALB Security Group          |
      +------------------┬-------------------+
                         │
                         ▼
                  NodePort :32637
                         │
                         ▼
                    kube-proxy
                         │
                         ▼
              ingress-nginx Service :80
                         │
                         ▼
              Ingress Controller Pod
                         │
               ┌─────────┴──────────┐
               ▼                    ▼
      frontend-service        backend-service
           Port 80               Port 5000
               │                    │
               ▼                    ▼
        Frontend Pod         Backend Pod










#####  After this, your complete AWS architecture will be:


                    User
                      │
             http://pburls.com
                      │
                      ▼
               DNS (Route53)
                      │
                      ▼
      ALB DNS (AWS Application Load Balancer)
                      │
                      ▼
        ALB Listener (HTTP :80 / HTTPS :443)
                      │
                      ▼
               Target Group
                      │
          Health Check on :32637
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
   EC2-1 (Node-1)              EC2-2 (Node-2)
      :32637                      :32637
        │                           │
        └─────────────┬─────────────┘
                      ▼
                kube-proxy
                      ▼
         ingress-nginx Service :80
                      ▼
          Ingress Controller Pod
                      ▼
         frontend-service :80
                      ▼
            Frontend Pods

         backend-service :5000
                      ▼
            Backend Pods















### Before this your current setup :




Before ALB (Your Current Setup)
Browser
   │
http://16.170.126.193:32637
   │
   ▼
Internet
   │
   ▼
Elastic IP
   │
   ▼
EC2
   │
32637
   ▼
Ingress
   │
Pods





#### After load balancer  your setup :









