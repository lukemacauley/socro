1. sendMessage (convex/conversations.ts): Creates a stream ID and stores the user message with that ID
2. useStream hook (/src/components/StreamingMessage.client.tsx:20): When isDriven is true, triggers an HTTP request to the streaming endpoint
3. HTTP request (src/react/index.ts): Sends POST to /stream-ai-response with the stream ID
4. streamChat httpAction (convex/routes.ts):


    - Calls OpenAI's streaming API
    - Uses streamingComponent.stream() to handle the response
    - Returns a streaming HTTP response immediately

5. streamingComponent.stream() (convex/routes.ts):


    - Creates a TransformStream for real-time streaming
    - Provides a chunkAppender callback that writes chunks to both:
        - The HTTP response stream (real-time to client)
      - The database (persisted at sentence boundaries)
    - Returns the readable stream as HTTP response

6. Client receives chunks (useStream in StreamingMessages):


    - Reads from response.body stream
    - Updates React state with each chunk
    - Shows real-time AI response in UI

The key is that streamingComponent.stream() returns a streaming HTTP response immediately while the AI generates content asynchronously.
