const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

// Rota principal para perguntas
app.post('/ask', async (req, res) => {
  const { question } = req.body;
  
  if (!question) {
    return res.status(400).json({ error: 'Pergunta é obrigatória' });
  }

  try {
    console.log(`📝 Pergunta recebida: ${question}`);
    
    // Primeira tentativa: Groq API (Llama - GRATUITO)
    try {
      const groqResponse = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: "llama3-8b-8192",
          messages: [
            {
              role: "system",
              content: "Você é um assistente útil que responde perguntas em português de forma clara e objetiva."
            },
            {
              role: "user",
              content: question
            }
          ],
          max_tokens: 300,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const answer = groqResponse.data.choices[0].message.content;
      console.log(`✅ Resposta do Groq gerada com sucesso`);
      return res.json({ 
        answer,
        model: 'llama3-8b-8192',
        provider: 'Groq'
      });

    } catch (groqError) {
      console.log(`⚠️ Groq falhou, tentando Hugging Face: ${groqError.message}`);
      
      // Segunda tentativa: Hugging Face (GRATUITO)
      const hfResponse = await axios.post(
        'https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium',
        {
          inputs: question,
          parameters: {
            max_length: 200,
            temperature: 0.7,
            do_sample: true
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const answer = hfResponse.data[0]?.generated_text || 'Desculpe, não consegui gerar uma resposta.';
      console.log(`✅ Resposta do Hugging Face gerada`);
      return res.json({ 
        answer,
        model: 'DialoGPT-medium',
        provider: 'Hugging Face'
      });
    }

  } catch (error) {
    console.error(`❌ Erro geral:`, error.message);
    res.status(500).json({ 
      error: 'Erro ao chamar a API LLM', 
      details: error.message,
      suggestion: 'Verifique se as chaves de API estão configuradas corretamente'
    });
  }
});

// Rota para análise de contexto (como Agatha Christie)
app.post('/analyze', async (req, res) => {
  const { text, context = 'geral' } = req.body;
  
  if (!text) {
    return res.status(400).json({ error: 'Texto é obrigatório' });
  }

  const prompts = {
    literatura: `Como especialista em literatura, analise este texto: "${text}". Foque nos aspectos literários, estilo e importância.`,
    biografia: `Como biógrafo, analise este texto sobre uma pessoa: "${text}". Destaque eventos importantes da vida e legado.`,
    obras: `Como crítico literário, analise esta obra: "${text}". Foque no enredo, personagens e significado.`,
    geral: `Analise e resuma este texto: "${text}". Forneça um resumo claro e informativo.`
  };

  const prompt = prompts[context] || prompts.geral;

  try {
    const groqResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: "llama3-8b-8192",
        messages: [
          {
            role: "system",
            content: "Você é um especialista que fornece análises detalhadas e precisas em português."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 400,
        temperature: 0.6
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const analysis = groqResponse.data.choices[0].message.content;
    console.log(`Análise contextual gerada: ${context}`);
    
    res.json({ 
      analysis,
      context,
      model: 'llama3-8b-8192',
      provider: 'Groq'
    });

  } catch (error) {
    console.error(`Erro na análise:`, error.message);
    res.status(500).json({ 
      error: 'Erro ao gerar análise', 
      details: error.message 
    });
  }
});

// Rota de teste
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Servidor funcionando!',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, () => {
  console.log(`   Servidor rodando em http://localhost:${port}`);
  console.log(`   Endpoints disponíveis:`);
  console.log(`   POST /ask - Perguntas gerais`);
  console.log(`   POST /analyze - Análise contextual`);
  console.log(`   GET /health - Status do servidor`);
  console.log(`   Certifique-se de configurar as variáveis de ambiente no arquivo .env`);
});
