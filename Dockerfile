# Use a lightweight base image that has both Node and Python
FROM node:18-alpine

# Install Python3, pip, and ffmpeg
RUN apk add --no-cache python3 py3-pip ffmpeg curl

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install app dependencies
RUN npm install

# Copy app source
COPY . .

# Build the frontend (Vite)
RUN npm run build

# Install yt-dlp binary manually to ensure latest version
# (We use the binary instead of pip for easy path management, but pip is also fine)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod +x /usr/local/bin/yt-dlp

# Expose the port the app runs on
EXPOSE 8080
ENV PORT=8080

# Define the command to run the app
CMD [ "npm", "run", "server" ]
