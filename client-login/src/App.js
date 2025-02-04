import React, { useState } from "react";

const App = () => {
  const [accessToken, setAccessToken] = useState("");
  const [message, setMessage] = useState("");
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");

  const handleSignin = async () => {
    try {
      const response = await fetch("http://localhost:3000/signin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (response.status === 401) {
        throw new Error("Invalid credentials");
      }

      const data = await response.json();
      setAccessToken(data.accessToken);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  };

  const getNewAccessToken = async () => {
    try {
      const response = await fetch("http://localhost:3000/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setAccessToken(data.accessToken);
        return data.accessToken;
      } else {
        throw new Error("Failed to refresh access token");
      }
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  const apiCall = async (url, options) => {
    try {
      let response = await fetch(url, options);
      if (response.status === 401) {
        const newAccessToken = await getNewAccessToken();

        if (newAccessToken) {
          options.headers.Authorization = `Bearer ${newAccessToken}`;
          response = await fetch(url, options);
        } else {
          throw new Error("Unauthorized");
        }
      }
      const data = await response.json();
      if (response.status === 403) {
        throw new Error(data.message);
      }

      const newAccessToken = response.headers.get("X-New-Access-Token");
      if (newAccessToken) setAccessToken(newAccessToken);

      return data;
    } catch (error) {
      setError(error.message);
      throw error;
    }
  };
  const fetchPosts = async () => {
    try {
      const data = await apiCall("http://localhost:3000/posts", {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
      });
      setPosts(data.posts);
    } catch (err) {
      setError(err.message);
      return;
    }
  };

  const handleAddPost = async () => {
    try {
      const response = await apiCall("http://localhost:3000/posts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
        credentials: "include",
      });

      if (response.status === 403) {
        console.log("response.message", response);
        throw new Error(response.message);
      }
      setPosts(response.posts);
      setMessage("");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      const response = await fetch("http://localhost:3000/logout", {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        setAccessToken("");
        setPosts([]);
        setMessage("");
        setError("");
      } else {
        throw new Error("Failed to logout");
      }
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <div>
      <h1>React Test App</h1>

      <div>
        <button onClick={handleSignin}>Sign In</button>
      </div>

      <div>
        <button onClick={fetchPosts}>Fetch Posts</button>

        <ul>
          {posts?.map((post, index) => (
            <li key={index}>{post}</li>
          ))}
        </ul>

        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write a sentence"
        />
        <button onClick={handleAddPost}>Add Post</button>
        <button onClick={handleLogout}>Logout</button>
      </div>

      {error && <div style={{ color: "red" }}>{error}</div>}
    </div>
  );
};

export default App;
