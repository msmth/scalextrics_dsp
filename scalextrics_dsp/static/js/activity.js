document.addEventListener("DOMContentLoaded", function () {
  let activities = [];
  let currentActivityIndex = 0;
  let currentQuestionIndex = 0;

  // Fetch activity data
  fetch("/static/data/activities.json")
      .then(response => {
          if (!response.ok) {
              throw new Error('Failed to load activities JSON');
          }
          return response.json();
      })
      .then(data => {
          activities = data;
          console.log("Activities loaded: ", activities);  // Debugging line to check the loaded data
          loadActivity(currentActivityIndex);
      })
      .catch(error => {
          console.error("Error loading activities:", error);
      });

  // Load activity content
function loadActivity(index) {
  if (activities.length === 0) return;

  const activity = activities[index];
  console.log("Loading activity: ", activity);  // Debugging line to see which activity is being loaded

  // Update title and description
  document.getElementById("activity-title").innerText = activity.section;

  // Check if description exists and is an array
  const descriptionHTML = activity.questions
      .map(question => {
          if (Array.isArray(question.description)) {
              return `<div class="description-box"><p>${question.description.join(" ")}</p></div>`;
          } else {
              // If description is not an array, just display it as a string
              return `<div class="description-box"><p>${question.description}</p></div>`;
          }
      })
      .join("");

  document.getElementById("activity-description").innerHTML = descriptionHTML;

  const questionsContainer = document.getElementById("questions-container");
  questionsContainer.innerHTML = "";  // Clear any previous questions
  activity.questions.forEach((question, i) => {
      const questionElement = createQuestionElement(question, i);
      questionsContainer.appendChild(questionElement);
  });

  // Hide "Next" button initially
  document.getElementById("next-button").classList.add("hidden");
  document.getElementById("next-button").disabled = true;  // Disable the button initially
}

  // Create question elements dynamically
  function createQuestionElement(question, index) {
    const container = document.createElement("div");
    container.classList.add("question-box"); // Apply the question box styling

    const questionText = document.createElement("p");
    questionText.innerText = question.question;
    container.appendChild(questionText);

    // Create buttons based on question type
    if (question.type === "information") {
        // For information questions, show "continue" button
        const continueButton = document.createElement("button");
        continueButton.innerText = "Continue";
        continueButton.addEventListener("click", () => nextQuestion(index));
        container.appendChild(continueButton);
    } else if (question.type === "short-answer") {
        // For short-answer questions, show text input and submit button
        const input = document.createElement("input");
        input.type = "text";
        input.placeholder = "Your answer here...";
        input.id = `short-answer-${index}`;
        container.appendChild(input);

        const submitButton = document.createElement("button");
        submitButton.innerText = "Submit";
        submitButton.addEventListener("click", () => checkShortAnswer(index));
        container.appendChild(submitButton);

        // Create feedback container for short-answer question
        const feedback = document.createElement("div");
        feedback.id = `feedback-${index}`;
        container.appendChild(feedback);
    } else if (question.type === "multiple-choice") {
        // For multiple-choice questions, show buttons for each choice
        const choicesContainer = document.createElement("div");
        question.choices.forEach(choice => {
            const button = document.createElement("button");
            button.innerText = choice;
            button.addEventListener("click", () => checkMultipleChoiceAnswer(choice, index));
            choicesContainer.appendChild(button);
        });
        container.appendChild(choicesContainer);

        // Create feedback container for multiple-choice question
        const feedback = document.createElement("div");
        feedback.id = `feedback-${index}`;
        container.appendChild(feedback);
    }

    return container;
  }


  function nextQuestion(index) {
      currentQuestionIndex++;
      const activity = activities[currentActivityIndex];

      // Check if all questions have been answered correctly
      if (currentQuestionIndex >= activity.questions.length) {
          // All questions have been answered correctly, show the "Next" button
          document.getElementById("next-button").classList.remove("hidden");
          document.getElementById("next-button").disabled = false;  // Enable the Next button
      } else {
          // Load the next question without resetting the entire activity
          loadActivity(currentActivityIndex);
      }
  }

  function checkShortAnswer(index) {
    const userAnswer = document.getElementById(`short-answer-${index}`).value.trim();
    console.log("User answer:", userAnswer); // Log the user input for debugging

    const feedbackElement = document.getElementById(`feedback-${index}`);
    feedbackElement.innerHTML = "";  // Clear previous feedback

    // Send the user's answer to the server for validation
    fetch('/check_answer', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ answer: userAnswer })
    })
    .then(response => response.json())
    .then(data => {
        if (data.result === 'correct') {
            feedbackElement.innerHTML = "<span style='color: green;'>Correct!</span>";
            nextQuestion(index);
        } else {
            feedbackElement.innerHTML = "<span style='color: red;'>Incorrect, try again!</span>";
        }
    })
    .catch(error => {
        console.error("Error checking answer:", error);
        feedbackElement.innerHTML = "<span style='color: red;'>Error checking answer. Please try again later.</span>";
    });
}

  function checkMultipleChoiceAnswer(choice, index) {
      const correctAnswer = activities[currentActivityIndex].questions[index].answer;
      console.log("User selected:", choice);  // Log selected choice for debugging

      const feedbackElement = document.getElementById(`feedback-${index}`);
      feedbackElement.innerHTML = "";  // Clear previous feedback

      if (choice === correctAnswer) {
          feedbackElement.innerHTML = "<span style='color: green;'>Correct!</span>";
          nextQuestion(index);
      } else {
          feedbackElement.innerHTML = "<span style='color: red;'>Incorrect, try again!</span>";
      }
  }

  // Show the next activity after all questions are answered
  document.getElementById("next-button").addEventListener("click", function () {
      if (currentActivityIndex < activities.length - 1) {
          currentActivityIndex++;
          currentQuestionIndex = 0;  // Reset question index for next activity
          loadActivity(currentActivityIndex);
      }
  });
});

