# Use an official Node runtime as a parent image
FROM node:23-alpine

# Install git so we can clone the repository
RUN apk update && apk add --no-cache python3 make g++ git

# Set the working directory
WORKDIR /usr/src/app

# Clone the repository from the main branch
RUN git clone -b main https://github.com/verida/data-connector-server.git

# Install pm2 globally
RUN yarn global add pm2

# Change directory to the cloned repository
WORKDIR /usr/src/app/data-connector-server

# Install dependencies and build the project
RUN yarn && yarn build

# Expose the internal port that the server listens on
EXPOSE 5021

# Start the server using yarn
CMD ["pm2-runtime", "dist/server.js", "--name", "dcs"]
