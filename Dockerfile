# Stage 1: Build the React frontend
FROM node:24-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build the Spring Boot backend (with embedded frontend)
FROM maven:3.9-eclipse-temurin-17 AS backend-build
WORKDIR /app/backend
COPY backend/pom.xml ./
# Download dependencies separately for Docker layer caching
RUN mvn dependency:go-offline -q
COPY backend/src ./src
# Copy compiled frontend into Spring Boot static resources
COPY --from=frontend-build /app/frontend/dist ./src/main/resources/static
RUN mvn package -DskipTests -q

# Stage 3: Minimal production image
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
# Add non-root user for OpenShift/security best practice
RUN addgroup -S scrumpoker && adduser -S scrumpoker -G scrumpoker
USER scrumpoker
COPY --from=backend-build /app/backend/target/scrumpoker-backend.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
