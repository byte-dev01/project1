
import React from "react";
import { useQuery } from "@tanstack/react-query";

// Fetch a single post using the postID
const fetchPost = (postID) =>
  fetch(`https://jsonplaceholder.typicode.com/posts/${postID}`).then((res) =>
    res.json()
  );

const Post = ({ postID, goBack }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["post", postID],
    queryFn: () => fetchPost(postID),
    enabled: !!postID, // Only run if postID is truthy
    staleTime: Infinity,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading post.</div>;

  return (
    <div>
      <a href="#" onClick={goBack}>
        Go back
      </a>
      <h1>Post ID: {data.id}</h1>
      <h2>{data.title}</h2>
      <p>{data.body}</p>
    </div>
  );
};

export default Post;
