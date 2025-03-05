const fs = require('fs');

class llm {
  constructor(){
    this.llmMessage = []
  }

  static message(settings, windw, prompt) {
    this.llmMessage = [];

    var currentLineHistory = windw.contentHistory.length;
    var memoryStartLine = currentLineHistory - settings.ollamaMemoryMax;
    memoryStartLine = (memoryStartLine < 0 ? 0 : memoryStartLine)
    var maxLineHistory = (currentLineHistory <= settings.ollamaMemoryMax ? currentLineHistory : settings.ollamaMemoryMax )

    this.llmMessage.push({ role: "system", content: windw.system_prompt });

    for(var i = 0; i <= maxLineHistory-1; i++){
      let type = (windw.contentHistory[memoryStartLine+i][0] == "assistant" ? "assistant" : "user")
      this.llmMessage[i+1] = { role: type, content: windw.contentHistory[memoryStartLine+i][1] }
    }
    
    this.llmMessage.push({ role: "user", content: prompt })

    console.log(windw.ollamaMessage)
    return windw.ollamaMessage;
  }

  static async send(settings, windw, user_prompt, callback) {
    const url = 'http://127.0.0.1:11434/v1/chat/completions'; 

    const payload = {
      model: windw.model,
      temperature: 0.2,
      top_p: 0.8,
      stream: false,
      stop: [
          "<|start_header_id|>",
          "<|end_header_id|>",
          "<|eot_id|>"
      ],    
      messages: this.message(settings, windw, user_prompt)   
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {'Content-Type': 'application/json'},
        });

        if (!response.ok) throw new Error('Erreur de communication avec l\'API Ollama');
      
        let data = await response.json();
        let array = data.choices[0].message.content.match(/.{1,70}(?:\s|$)/g);

        callback(array);
    } catch (error) {
        console.error("Erreur lors de l'envoi ou de la réception du message", error);
    }
  }

  updatePrompt(){
    try {
      return JSON.parse(fs.readFileSync('../prompt.txt', 'utf8'));
    } catch (err) {
      console.log(err);
      process.exit()
    }
  }
}

module.exports = { llm: llm };