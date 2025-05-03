document.addEventListener("DOMContentLoaded", () => {
    let activities = [];
    let currentActivityIndex = 0;
    let currentQuestionIndex = 0;
    const userAnswers = {};

    fetch("/static/data/activities.json")
        .then(res => res.json())
        .then(data => {
            activities = data;
            loadQuestion();
        })
        .catch(err => console.error("Failed to load JSON:", err));

    function loadQuestion() {
        const activity = activities[currentActivityIndex];
        const question = activity.questions[currentQuestionIndex];

        setText("activity-title", activity.section || "Untitled Section");

        const descriptionHTML = Array.isArray(question.description) ? question.description.join(" ") : question.description;
        setHTML("activity-description", `<div class="description-box">${descriptionHTML}</div>`);

        const container = document.getElementById("questions-container");
        container.innerHTML = "";

        const questionBox = createQuestionBox(question);
        container.appendChild(questionBox);

        updateNavigationButtons(activity);
        resetFeedback();
    }

    function createQuestionBox(question) {
        const box = document.createElement("div");
        box.className = "question-box";
    
        const qText = document.createElement("p");
        qText.innerText = question.question;
        box.appendChild(qText);
    
        if (question.type === "short-answer") {
            const input = document.createElement("input");
            input.id = "answer-input";
            input.placeholder = "Your answer";
            box.appendChild(input);
    
            const button = document.createElement("button");
            button.innerText = "Submit";
            button.onclick = () => checkShortAnswer(question);
            box.appendChild(button);
        } 
        else if (question.type === "multiple-choice") {
            const choicesContainer = document.createElement("div");
            choicesContainer.className = "choices-container";
    
            question.choices.forEach((choice, index) => {
                const label = document.createElement("label");
                label.className = "choice-label";
    
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox"; // allow multiple selection
                checkbox.name = "multiple-choice";
                checkbox.value = choice;
                checkbox.id = `choice-${index}`;
    
                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(choice));
                choicesContainer.appendChild(label);
                choicesContainer.appendChild(document.createElement("br"));
            });
    
            box.appendChild(choicesContainer);
    
            const button = document.createElement("button");
            button.innerText = "Submit";
            button.onclick = (event) => checkMultipleChoiceAnswer(question, event);
            box.appendChild(button);
        }
    
        if (question.hints?.length) {
            box.appendChild(createHintBox(question));
        }
    
        return box;
    }
    

    function checkMultipleChoiceAnswer(question, event) {
        const button = event.target;
        const box = button.closest(".question-box"); // Find the nearest parent question box
        const selectedElements = box.querySelectorAll('input[name="multiple-choice"]:checked');
        
        if (selectedElements.length === 0) {
            showFeedback("Please select at least one option.", "incorrect");
            return;
        }
    
        const selectedAnswers = Array.from(selectedElements).map(input => input.value.trim().toLowerCase());
        const key = `${currentActivityIndex}-${currentQuestionIndex}`;
        userAnswers[key] = selectedAnswers;
    
        const correctAnswers = (question.validation?.predefinedAnswers || []).map(ans => ans.trim().toLowerCase());
    
        if (correctAnswers.length === 0) {
            showFeedback("No correct answers defined.", "incorrect");
            return;
        }
    
        // Compare selected answers to correct answers (ignoring order)
        const isCorrect = arraysEqual(selectedAnswers, correctAnswers);
    
        validateAnswer(isCorrect);
    
        function validateAnswer(isCorrect) {
            if (isCorrect) {
                showFeedback("Correct!", "correct");
                enableNextButton();
            } else {
                showFeedback("Incorrect, try again.", "incorrect");
            }
        }
    }
    
    
    // Helper function to check if two arrays contain the same elements (order doesn't matter)
    function arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        const sortedA = [...a].sort();
        const sortedB = [...b].sort();
        return sortedA.every((val, index) => val === sortedB[index]);
    }
    
    
    function createHintBox(question) {
        const container = document.createElement("div");
        container.className = "hint-container";

        const button = document.createElement("button");
        const timer = document.createElement("span");
        const hintText = document.createElement("div");

        let index = 0;
        let interval;

        button.innerText = "Show Hint";
        timer.className = "hint-timer";
        hintText.className = "hint-text";

        button.addEventListener("click", () => {
            if (index < question.hints.length) {
                const hint = document.createElement("p");
                hint.innerHTML = `<strong>Hint ${index + 1}:</strong> ${question.hints[index++]}`;
                hintText.appendChild(hint);

                button.disabled = true;

                if (index < question.hints.length) {
                    let countdown = 10;
                    timer.innerText = `(Next in ${countdown}s)`;
                    interval = setInterval(() => {
                        countdown--;
                        timer.innerText = `(Next in ${countdown}s)`;
                        if (countdown <= 0) {
                            clearInterval(interval);
                            button.disabled = false;
                            timer.innerText = "";
                        }
                    }, 1000);
                } else {
                    button.innerText = "No more hints";
                    button.disabled = true;
                    timer.innerText = "";
                }
            }
        });

        container.append(button, timer, hintText);
        return container;
    }

    function checkShortAnswer(question) {
        const input = document.getElementById("answer-input").value.trim();
        const key = `${currentActivityIndex}-${currentQuestionIndex}`;
        userAnswers[key] = input;

        const validation = question.validation;

        if (validation?.predefinedAnswer) {
            let expected = validation.predefinedAnswer;
        
            // Replace placeholders like [IP_ADDRESS] with saved answers
            expected = expected.replace(/\[([^\]]+)]/g, (_, key) => {
                return getSavedNoteByKey(key) || `[${key}]`;
            });
        
            validateAnswer(input.trim().toLowerCase() === expected.trim().toLowerCase());        
        } else if (validation?.format) {
            const regex = new RegExp(validation.format);
            validateAnswer(regex.test(input));
        } else {
            fetch('/check_answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answer: input })
            })
            .then(res => res.json())
            .then(data => {
                if (data.result === "correct") {
                    validateAnswer(true);
                } else {
                    showFeedback(data.result === "error" ? "Please run ifconfig first." : "Incorrect, try again.", "incorrect");
                }
            })
            .catch(console.error);
        }

        function validateAnswer(isCorrect) {
            if (isCorrect) {
                showFeedback("Correct!", "correct");
                enableNextButton();
                if (isCorrect && question.saveAsNote) {
                    saveAnswerAsNote(question, input);
                }                
            } else {
                showFeedback("Incorrect, try again.", "incorrect");
            }
        }
    }

    function saveAnswerAsNote(question, input) {
        const key = question.noteKey;
        if (!key) return;
    
        userAnswers[key] = input;  // Save it globally
    
        const list = document.getElementById("saved-answers-list");
        const listItem = document.createElement("li");
    
        const label = question.noteLabel || question.question || key;
    
        const span = document.createElement("span");
        span.innerHTML = `<strong>${label}:</strong> <span class="note-value">${input}</span>`;
    
        const copyButton = document.createElement("button");
        copyButton.innerText = "Copy";
        copyButton.className = "copy-button";
        copyButton.onclick = () => {
            navigator.clipboard.writeText(input)
                .then(() => copyButton.innerText = "Copied!")
                .catch(() => copyButton.innerText = "Failed");
    
            setTimeout(() => copyButton.innerText = "Copy", 1500);
        };
    
        listItem.appendChild(span);
        listItem.appendChild(copyButton);
        list.appendChild(listItem);
    }
    
    function getSavedNoteByKey(key) {
        return userAnswers[key];
    }
    
    
    function enableNextButton() {
        setTimeout(() => {
            const next = document.getElementById("next-button");
            next.classList.remove("hidden");
            next.disabled = false;
        });
    }

    function showFeedback(message, status = "correct") {
        const fb = document.getElementById("feedback-message");
        fb.innerText = message;
        fb.className = status;
        fb.classList.remove("hidden");

        setTimeout(() => fb.classList.add("hidden"), 3000);
    }

    function updateNavigationButtons(activity) {
        const prev = document.getElementById("previous-button");
        const next = document.getElementById("next-button");

        const first = currentActivityIndex === 0 && currentQuestionIndex === 0;
        const last = currentActivityIndex === activities.length - 1 && currentQuestionIndex === activity.questions.length - 1;

        prev.disabled = first;
        next.classList.toggle("hidden", last);
        next.disabled = true;
    }

    function resetFeedback() {
        const fb = document.getElementById("feedback-message");
        fb.classList.add("hidden");
        fb.innerText = "";
    }

    function setText(id, text) {
        document.getElementById(id).innerText = text;
    }

    function setHTML(id, html) {
        document.getElementById(id).innerHTML = html;
    }

    document.getElementById("next-button").addEventListener("click", () => {
        const activity = activities[currentActivityIndex];

        if (currentQuestionIndex < activity.questions.length - 1) {
            currentQuestionIndex++;
        } else if (currentActivityIndex < activities.length - 1) {
            currentActivityIndex++;
            currentQuestionIndex = 0;
        } else {
            showFeedback("Congratulations! You've completed the activity.", "correct");
            return;
        }

        loadQuestion();
        setText("next-button", "Next");
    });

    document.getElementById("previous-button").addEventListener("click", () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
        } else if (currentActivityIndex > 0) {
            currentActivityIndex--;
            currentQuestionIndex = activities[currentActivityIndex].questions.length - 1;
        }
        loadQuestion();
    });
});