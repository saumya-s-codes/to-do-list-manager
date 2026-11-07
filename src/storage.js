// storage.js - Clear the Day

export function getStoredTasks() {
  try {
    const tasks = localStorage.getItem('tasks');
    return tasks ? JSON.parse(tasks) : [];
  } catch (e) {
    console.error("Failed to load tasks from storage", e);
    return [];
  }
}

export function saveTasks(tasks) {
  try {
    localStorage.setItem('tasks', JSON.stringify(tasks));
  } catch (e) {
    console.error("Failed to save tasks to storage", e);
  }
}

// Robust CSV line parser that correctly handles commas inside quotes
function parseCSVLine(line) {
  const result = [];
  let insideQuote = false;
  let entry = '';
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      insideQuote = !insideQuote;
    } else if (char === ',' && !insideQuote) {
      result.push(entry.trim().replace(/^["']|["']$/g, ''));
      entry = '';
    } else {
      entry += char;
    }
  }
  result.push(entry.trim().replace(/^["']|["']$/g, ''));
  return result;
}

export function restoreFromCsv(file, onComplete) {
  if (!file) {
    if (onComplete) onComplete(false, "No file selected.");
    return;
  }

  const reader = new FileReader();

  reader.onload = (event) => {
    try {
      const text = event.target.result;
      const lines = text.split(/\r\n|\n/).filter(line => line.trim().length > 0);
      
      if (lines.length < 2) {
        if (onComplete) onComplete(false, "CSV file is empty or missing data rows.");
        return;
      }

      // Parse headers from the first line
      const headers = parseCSVLine(lines[0]);
      const tasks = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const task = {};

        headers.forEach((header, index) => {
          let val = values[index] !== undefined ? values[index] : '';
          
          // Convert string booleans back to actual booleans
          if (val === 'true') val = true;
          if (val === 'false') val = false;
          
          task[header] = val;
        });

        // Ensure task has minimum required fields and normalize properties
        if (task.text || task.title || task.id) {
          tasks.push({
            id: task.id || String(Date.now() + i),
            text: task.text || task.title || 'Untitled Task',
            completed: task.completed === true || task.completed === 'true',
            dueDate: task.dueDate || null,
            ...task
          });
        }
      }

      if (tasks.length === 0) {
        if (onComplete) onComplete(false, "No valid tasks found in the CSV file.");
        return;
      }

      // Save parsed tasks to localStorage
      localStorage.setItem('tasks', JSON.stringify(tasks));
      
      if (onComplete) onComplete(true, `Successfully restored ${tasks.length} tasks!`);
      
      // Refresh app to load restored tasks
      setTimeout(() => window.location.reload(), 1000);

    } catch (error) {
      console.error("Failed to parse CSV backup:", error);
      if (onComplete) onComplete(false, "Could not read CSV file. Format may be invalid.");
    }
  };

  reader.onerror = () => {
    if (onComplete) onComplete(false, "Error reading file.");
  };

  reader.readAsText(file);
}