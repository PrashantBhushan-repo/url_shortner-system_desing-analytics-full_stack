# syntax=docker/dockerfile:1.7
# Deployment files travel through private GHCR too: no S3 or Git clone on EC2.
FROM scratch
COPY infrastructure /bundle/infrastructure
COPY release.env /bundle/release.env
LABEL org.opencontainers.image.title="PBUrls deployment bundle"
CMD ["/not-started"]
