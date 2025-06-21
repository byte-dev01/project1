import React, { Component } from "react";
import Card from "../modules/Card.js";
import { NewStory } from "../modules/NewPostInput.js";
import { get } from "../../utilities";

class Feed extends Component {
  constructor(props) {
    super(props);
    this.state = {
      stories: [],
      loading: false,
    };
  }

  componentDidMount() {
    if (this.props.userId) {
      this.setState({ loading: true });
      get("/api/stories")
        .then((storyObjs) => {
          console.log("Fetched stories:", storyObjs);
          const reversedStoryObjs = storyObjs.reverse();
          this.setState({ stories: reversedStoryObjs, loading: false });
        })
        .catch((err) => {
          console.error("Error fetching stories:", err);
          this.setState({ loading: false });
        });
    }
  }

  addNewStory = (storyObj) => {
    this.setState((prevState) => ({
      stories: [storyObj, ...prevState.stories],
    }));
  };

  render() {
    const { userId } = this.props;
    const { stories, loading } = this.state;

    let content;
    if (loading) {
      content = <div>Loading...</div>;
    } else if (stories.length > 0) {
      content = stories.map((storyObj) => (
        <Card
          key={`Card_${storyObj._id}`}
          _id={storyObj._id}
          creator_name={storyObj.creator_name}
          creator_id={storyObj.creator_id}
          content={storyObj.content}
          userId={userId}
        />
      ));
    } else {
      content = <div>No stories!</div>;
    }

    return (
      <>
        {userId && <NewStory addNewStory={this.addNewStory} />}
        {content}
      </>
    );
  }
}

export default Feed;
