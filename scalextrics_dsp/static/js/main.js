let questions = [];
let currentQuestionIndex = 0;
let lastOutput = "";

// // Load questions from the server
// async function loadQuestions() {
//     try {
//         const response = await fetch("/questions");
//         if (!response.ok) throw new Error("Failed to fetch questions");
//         questions = await response.json();
//         loadQuestion(); // Load the first question after fetching successfully
//     } catch (error) {
//         console.error("Error loading questions:", error);
//     }
// }

function loadQuestion() {
    const question = document.getElementById("question");
    const instructions = document.getElementById("instructions");
    const feedback = document.getElementById("feedback");
    const nextButton = document.getElementById("next-button");
    const answerContainer = document.getElementById("answer-container");
    const submitButton = document.getElementById("submit-button");
    const previousButton = document.getElementById("previous-button");

    // Clear previous feedback and answer container
    feedback.textContent = "";
    answerContainer.innerHTML = "";  // Clear previous answers
    nextButton.style.display = "none";  // Hide next button initially

    const currentQuestion = questions[currentQuestionIndex];
    instructions.innerHTML = currentQuestion.instructions;

    // Add a story-driven message for the current mission
    const missionTitle = document.getElementById("mission-title");
    missionTitle.textContent = currentQuestion.question;

    // Show/hide the Previous button based on the question index
    previousButton.style.display = currentQuestionIndex > 0 ? "block" : "none";

    if (currentQuestion.type === "short_answer") {
        // Display the question and input box for short answer
        question.textContent = currentQuestion.question;
        const input = document.createElement("input");
        input.type = "text";
        input.id = "answer-input";
        input.placeholder = "Enter your answer here";
        answerContainer.appendChild(input);
        submitButton.style.display = "block";  // Show the submit button
    } else if (currentQuestion.type === "multiple_choice") {
        // Display the multiple-choice options
        question.textContent = currentQuestion.question;
        currentQuestion.choices.forEach((choice, index) => {
            const label = document.createElement("label");
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.name = "multiple-choice";
            checkbox.value = choice;
            label.appendChild(checkbox);
            label.appendChild(document.createTextNode(choice));
            
            // Add some styles to ensure the options are displayed vertically
            label.style.display = "block";  // Ensures label is displayed on a new line

            answerContainer.appendChild(label);
        });
        submitButton.style.display = "block";  // Show the submit button
    }

    // If all questions are completed
    if (currentQuestionIndex >= questions.length) {
        question.textContent = "All questions completed!";
        nextButton.style.display = "none";
        previousButton.style.display = "block";  // Show previous button at the end
    }

    if (currentQuestionIndex === questions.length) {
        const progressBarFill = document.getElementById('progress-bar-fill');
        progressBarFill.style.width = `100%`;
        progressBarFill.textContent = `100%`;
    }
    

    updateProgressBar();
}

function cleanTerminalOutput(output) {
    return output.replace(/\[.*?m/g, "") // Remove ANSI escape codes
                 .replace(/\[.*?h/g, "") // Remove terminal control sequences
                 .trim();               // Remove extra spaces
}

function submitAnswer() {
    const feedback = document.getElementById("feedback");
    const nextButton = document.getElementById("next-button");
    const currentQuestion = questions[currentQuestionIndex];

    let userAnswers = [];

    // Handle short-answer type
    if (currentQuestion.type === "short_answer") {
        const userAnswer = document.getElementById("answer-input").value.trim();
        const cleanedOutput = cleanTerminalOutput(lastOutput); // Clean the terminal output
        let isCorrect = false;

        // Check if there is a hardcoded answer
        if (currentQuestion.answer) {
            // If an answer is hardcoded, compare directly
            if (userAnswer === currentQuestion.answer) {
                isCorrect = true;
            }
        } else if (currentQuestion.pattern) {
            // If no hardcoded answer, check if the output matches the pattern
            const ipPattern = new RegExp(currentQuestion.pattern, "g");
            const matches = [];
            let match;
            
            // Extract matching items from the cleaned terminal output
            while ((match = ipPattern.exec(cleanedOutput)) !== null) {
                matches.push(match[1]); // Store each matched value
            }

            if (matches.includes(userAnswer)) {
                isCorrect = true;
            }
        }

        if (isCorrect) {
            feedback.textContent = "Correct!";
            feedback.style.color = "green";
            nextButton.style.display = "block"; // Show next button
        } else {
            feedback.textContent = "Incorrect. Try again.";
            feedback.style.color = "red";
            nextButton.style.display = "none"; // Hide next button
        }
    } else if (currentQuestion.type === "multiple_choice") {
        // Handle multiple choice type (same as your existing logic)
        const checkboxes = document.querySelectorAll("input[name='multiple-choice']:checked");
        checkboxes.forEach((checkbox) => {
            userAnswers.push(checkbox.value);
        });

        // Check if user's answers match the correct answers
        const correctAnswers = currentQuestion.correct_answers.sort();
        const isCorrect = userAnswers.sort().toString() === correctAnswers.toString();

        if (isCorrect) {
            feedback.textContent = "Correct!";
            feedback.style.color = "green";
            nextButton.style.display = "block"; // Show next button
        } else {
            feedback.textContent = "Incorrect. Try again.";
            feedback.style.color = "red";
            nextButton.style.display = "none"; // Hide next button
        }
    }

    // Debug logging for feedback
    console.log("Feedback:", feedback.textContent);
}

// Load the next question
function nextQuestion() {
    currentQuestionIndex++;
    loadQuestion();
}

// Load the previous question
function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        loadQuestion();
    }
}

// PROGRESS TRACKING //
// Function to update progress bar
function updateProgressBar() {
    const progressBarFill = document.getElementById('progress-bar-fill');
    const totalQuestions = questions.length;

    // Calculate the progress percentage correctly
    const progressPercentage = (currentQuestionIndex / totalQuestions) * 100;

    // Update the progress bar width and text
    progressBarFill.style.width = `${progressPercentage}%`;
    progressBarFill.textContent = `${Math.round(progressPercentage)}%`;
}

loadQuestions();