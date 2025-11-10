
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { analyzeCalendarImage, getChatResponse } from './services/geminiService';
import { Project, AnalyzedEvent, ChatMessage, CalendarImage } from './types';
import { UploadIcon, ChartPieIcon, DocumentReportIcon, ChatIcon, SendIcon, CloseIcon, TrashIcon, LightBulbIcon } from './components/Icons';

// --- HELPER FUNCTIONS ---
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1969',
  '#19D4FF', '#FFD700', '#32CD32', '#FF4500', '#9932CC', '#FF69B4'
];

// --- SUB-COMPONENTS ---

const Spinner: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex flex-col items-center justify-center space-y-4 text-slate-300">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-indigo-400"></div>
        <p className="text-lg font-semibold">{text}</p>
    </div>
);

const LoginScreen: React.FC<{ onLogin: () => void }> = ({ onLogin }) => (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl p-8 space-y-6 transform hover:scale-105 transition-transform duration-300">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">ChronoAI</h1>
                <p className="text-slate-400 mt-2">Your Personal AI Time Analyst</p>
            </div>
            <div className="space-y-4">
                <div>
                    <label className="text-sm font-bold text-slate-300 block mb-2">Username</label>
                    <input type="text" defaultValue="demo_user" className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                    <label className="text-sm font-bold text-slate-300 block mb-2">Password</label>
                    <input type="password" defaultValue="password" className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
            </div>
            <button
                onClick={onLogin}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-indigo-500"
            >
                Sign In
            </button>
        </div>
    </div>
);

const ImageUploader: React.FC<{ onImageUpload: (file: File) => void; isLoading: boolean }> = ({ onImageUpload, isLoading }) => {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) onImageUpload(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files?.[0]) onImageUpload(e.target.files[0]);
  };

  return (
    <div className="bg-slate-800 p-6 rounded-2xl shadow-lg">
      <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center">
        <UploadIcon className="w-6 h-6 mr-2 text-indigo-400" />
        Upload Calendar
      </h2>
      <form id="form-file-upload" onDragEnter={handleDrag} onSubmit={(e) => e.preventDefault()}>
        <input ref={inputRef} type="file" id="input-file-upload" className="hidden" accept="image/*" onChange={handleChange} disabled={isLoading} />
        <label
          htmlFor="input-file-upload"
          className={`h-48 flex justify-center items-center border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
            dragActive ? 'border-indigo-500 bg-slate-700' : 'border-slate-600 hover:border-indigo-500 hover:bg-slate-700'
          }`}
          onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
        >
          <div className="text-center text-slate-400">
            <UploadIcon className="w-10 h-10 mx-auto mb-2" />
            <p>Drag & drop your calendar image, or</p>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={isLoading} className="font-semibold text-indigo-400 hover:text-indigo-300 mt-1 focus:outline-none">
              click to browse
            </button>
          </div>
        </label>
      </form>
    </div>
  );
};

const ImageManager: React.FC<{ images: CalendarImage[]; onDelete: (id: string) => void }> = ({ images, onDelete }) => (
  <div className="bg-slate-800 p-6 rounded-2xl shadow-lg">
    <h2 className="text-xl font-bold text-slate-100 mb-4">Analyzed Images</h2>
    {images.length > 0 ? (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {images.map(image => (
          <div key={image.id} className="relative group">
            <img src={`data:image/jpeg;base64,${image.base64}`} alt="Calendar screenshot" className="rounded-lg w-full h-full object-cover"/>
            <button
              onClick={() => onDelete(image.id)}
              className="absolute top-1 right-1 bg-red-600/70 hover:bg-red-600 p-1 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Delete image"
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-slate-400 text-center py-4">No images uploaded yet.</p>
    )}
  </div>
);

const ProjectPieChart: React.FC<{ data: Project[] }> = ({ data }) => {
    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload?.[0]) {
            return (
                <div className="bg-slate-700 p-3 rounded-lg border border-slate-600 shadow-xl">
                    <p className="label text-slate-200">{`${payload[0].name} : ${payload[0].value.toFixed(1)} hours`}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-slate-800 p-6 rounded-2xl shadow-lg h-full flex flex-col">
            <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center">
                <ChartPieIcon className="w-6 h-6 mr-2 text-green-400" />
                Time Distribution
            </h2>
            <div className="flex-grow w-full h-full min-h-[300px]">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <defs>
                                {data.map((entry, index) => (
                                    <radialGradient id={`grad${index}`} key={`grad${index}`}>
                                        <stop offset="0%" stopColor={entry.color} stopOpacity={0.7} />
                                        <stop offset="100%" stopColor={entry.color} stopOpacity={1} />
                                    </radialGradient>
                                ))}
                            </defs>
                            <Pie data={data} cx="50%" cy="50%" innerRadius="50%" outerRadius="80%" dataKey="duration" nameKey="name" paddingAngle={5} cornerRadius={10} className="bubbly-pie">
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={`url(#grad${index})`} stroke={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.1)' }}/>
                            <Legend iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        <p>Upload a calendar to see your time distribution.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

interface ProjectRankingProps {
  projects: Project[];
  onUpdateProject: (originalNames: string[], newName: string, newColor: string) => void;
  onDeleteProject: (originalNames: string[]) => void;
}
const ProjectRanking: React.FC<ProjectRankingProps> = ({ projects, onUpdateProject, onDeleteProject }) => {
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('');

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setNewName(project.name);
    setNewColor(project.color);
  };
  
  const handleSave = () => {
    if (editingProject && newName.trim()) {
      onUpdateProject(editingProject.originalNames, newName.trim(), newColor);
    }
    setEditingProject(null);
  };
  
  const sortedProjects = [...projects].sort((a, b) => b.duration - a.duration);

  return (
    <div className="bg-slate-800 p-6 rounded-2xl shadow-lg">
      <h2 className="text-xl font-bold text-slate-100 mb-4">Project Ranking</h2>
      <ul className="space-y-3">
        {sortedProjects.map((project) => (
          <li key={project.name} className="flex items-center p-2 bg-slate-700 rounded-lg">
            {editingProject?.name === project.name ? (
              <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-8 h-8 rounded-md mr-3 cursor-pointer bg-slate-700 border border-slate-500"/>
            ) : (
              <div className="w-4 h-4 rounded-full mr-4 flex-shrink-0" style={{ backgroundColor: project.color }}></div>
            )}
            <div className="flex-grow">
              {editingProject?.name === project.name ? (
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSave()} className="bg-slate-600 text-white rounded px-2 py-1 w-full" autoFocus />
              ) : (
                <span className="text-slate-200">{project.name}</span>
              )}
            </div>
            <span className="font-semibold text-slate-300 mx-4">{project.duration.toFixed(1)}h</span>
            <div className="flex items-center space-x-2">
              <button 
                onClick={() => editingProject?.name === project.name ? handleSave() : handleEdit(project)} 
                className={`text-xs font-semibold py-1 px-2 rounded transition-colors ${
                  editingProject?.name === project.name 
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white' 
                    : 'text-indigo-400 hover:text-indigo-300'
                }`}
              >
                {editingProject?.name === project.name ? 'Save' : 'Edit'}
              </button>
              <button onClick={() => onDeleteProject(project.originalNames)} className="text-red-400 hover:text-red-300" aria-label={`Delete project ${project.name}`}>
                <TrashIcon className="w-4 h-4"/>
              </button>
            </div>
          </li>
        ))}
        {projects.length === 0 && <p className="text-slate-400 text-center py-4">No projects analyzed yet.</p>}
      </ul>
    </div>
  );
};

const ProjectRulesManager: React.FC<{
    rules: Record<string, string>;
    onAddRule: (keyword: string, targetProject: string) => void;
    onDeleteRule: (keyword: string) => void;
}> = ({ rules, onAddRule, onDeleteRule }) => {
    const [keyword, setKeyword] = useState('');
    const [targetProject, setTargetProject] = useState('');

    const handleAdd = () => {
        if (keyword.trim() && targetProject.trim()) {
            onAddRule(keyword.trim(), targetProject.trim());
            setKeyword('');
            setTargetProject('');
        }
    };

    return (
        <div className="bg-slate-800 p-6 rounded-2xl shadow-lg">
            <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center"><LightBulbIcon className="w-6 h-6 mr-2 text-yellow-400" /> AI Memory / Rules</h2>
            <div className="space-y-4">
                <div className="flex space-x-2">
                    <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Event keyword (e.g., 'Portugues')" className="flex-grow bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <input type="text" value={targetProject} onChange={(e) => setTargetProject(e.target.value)} placeholder="Assign to project (e.g., 'Idiomas')" className="flex-grow bg-slate-700 text-white rounded px-3 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <button onClick={handleAdd} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">Add Rule</button>
            </div>
            <div className="mt-6 space-y-2">
                <h3 className="text-lg font-semibold text-slate-300">Active Rules</h3>
                {Object.keys(rules).length > 0 ? (
                    <ul className="space-y-2">
                        {Object.entries(rules).map(([key, value]) => (
                            <li key={key} className="flex items-center justify-between p-2 bg-slate-700 rounded-lg">
                                <div>
                                    <span className="text-slate-400">If event contains "</span>
                                    <span className="font-semibold text-indigo-300">{key}</span>
                                    <span className="text-slate-400">", assign to "</span>
                                    <span className="font-semibold text-green-300">{value}</span>
                                    <span className="text-slate-400">"</span>
                                </div>
                                <button onClick={() => onDeleteRule(key)} className="text-red-400 hover:text-red-300"><TrashIcon className="w-5 h-5"/></button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-slate-400 text-center py-2">No rules defined yet.</p>
                )}
            </div>
        </div>
    );
};

const ReportGenerator: React.FC<{ projects: Project[]; chartContainerRef: React.RefObject<HTMLDivElement> }> = ({ projects, chartContainerRef }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleDownload = async () => {
    const chartElement = chartContainerRef.current;
    if (!chartElement || projects.length === 0) {
      alert("No data available to generate a report.");
      return;
    }
    setIsGenerating(true);

    const wasFloating = chartElement.classList.contains('floating');
    if (wasFloating) {
        chartElement.classList.remove('floating');
    }
    // Allow the DOM to update before capturing
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      const canvas = await html2canvas(chartElement, { 
        backgroundColor: '#1e293b', // slate-800
        scale: 2 // Higher scale for better quality
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgWidth / imgHeight;
      const newImgWidth = pdfWidth - 20; // 10mm margin on each side
      const newImgHeight = newImgWidth / ratio;

      pdf.setFontSize(22);
      pdf.setTextColor('#818cf8'); // indigo-400
      pdf.text('ChronoAI Time Report', 14, 22);
      
      pdf.addImage(imgData, 'PNG', 10, 35, newImgWidth, newImgHeight);

      let tableYStart = 35 + newImgHeight + 10;

      if (tableYStart > pdfHeight - 30) {
          pdf.addPage();
          tableYStart = 22;
      }
      
      pdf.setFontSize(18);
      pdf.setTextColor('#e2e8f0'); // slate-200
      pdf.text('Detailed Project Data', 14, tableYStart);
      
      autoTable(pdf, {
        startY: tableYStart + 8,
        head: [['Project', 'Duration (hours)']],
        body: projects.map(p => [p.name, p.duration.toFixed(2)]),
        theme: 'grid',
        headStyles: { fillColor: '#4f46e5' }, // indigo-600
      });

      pdf.save(`ChronoAI-Report-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF", error);
      alert("An error occurred while generating the PDF. Please check the console.");
    } finally {
      if (wasFloating) {
          chartElement.classList.add('floating');
      }
      setIsGenerating(false);
    }
  };
  
  return (
    <div className="mt-6">
      <button onClick={handleDownload} disabled={isGenerating || projects.length === 0} className="w-full flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-lg transition-all duration-300">
        <DocumentReportIcon className="w-6 h-6 mr-2" />
        {isGenerating ? 'Generating PDF...' : 'Download PDF Report'}
      </button>
    </div>
  );
};


const Chatbot: React.FC<{ projects: Project[] }> = ({ projects }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;
        const userMessage: ChatMessage = { sender: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = input;
        setInput('');
        setIsLoading(true);

        const chatHistory = messages.map(msg => ({ role: msg.sender === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] }));

        try {
            const aiResponseText = await getChatResponse(chatHistory, currentInput, projects);
            setMessages(prev => [...prev, { sender: 'ai', text: aiResponseText }]);
        } catch (error) {
            setMessages(prev => [...prev, { sender: 'ai', text: "Sorry, I couldn't connect. Please try again." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <button onClick={() => setIsOpen(!isOpen)} className="fixed bottom-6 right-6 bg-indigo-600 text-white w-16 h-16 rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-transform transform hover:scale-110">
                {isOpen ? <CloseIcon className="w-8 h-8"/> : <ChatIcon className="w-8 h-8" />}
            </button>
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-full max-w-sm h-[60vh] bg-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-700 animate-fade-in-up">
                    <div className="p-4 bg-slate-900 border-b border-slate-700">
                        <h3 className="font-bold text-lg text-white">ChronoAI Assistant</h3>
                    </div>
                    <div className="flex-grow p-4 overflow-y-auto space-y-4">
                        {messages.map((msg, index) => (
                            <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[80%] p-3 rounded-xl whitespace-pre-wrap ${msg.sender === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start"><div className="bg-slate-700 text-slate-200 p-3 rounded-xl"><div className="flex items-center space-x-2"><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div></div></div></div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                    <div className="p-4 border-t border-slate-700">
                        <div className="flex items-center bg-slate-700 rounded-full"><input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} placeholder="Ask about your time..." className="flex-grow bg-transparent p-3 text-white focus:outline-none" disabled={isLoading}/>
                            <button onClick={handleSend} disabled={isLoading} className="p-3 text-indigo-400 hover:text-indigo-300 disabled:text-slate-500"><SendIcon className="w-6 h-6"/></button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [calendarImages, setCalendarImages] = useState<CalendarImage[]>([]);
    const [userMappings, setUserMappings] = useState<Record<string, { name: string; color: string }>>({});
    const [projectRules, setProjectRules] = useState<Record<string, string>>({});
    const [ignoredProjects, setIgnoredProjects] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const savedImages = localStorage.getItem('chronoImages');
        const savedMappings = localStorage.getItem('chronoMappings');
        const savedIgnored = localStorage.getItem('chronoIgnored');
        const savedRules = localStorage.getItem('chronoRules');
        if (savedImages) setCalendarImages(JSON.parse(savedImages));
        if (savedMappings) setUserMappings(JSON.parse(savedMappings));
        if (savedIgnored) setIgnoredProjects(JSON.parse(savedIgnored));
        if (savedRules) setProjectRules(JSON.parse(savedRules));
    }, []);

    useEffect(() => {
        localStorage.setItem('chronoImages', JSON.stringify(calendarImages));
        localStorage.setItem('chronoMappings', JSON.stringify(userMappings));
        localStorage.setItem('chronoIgnored', JSON.stringify(ignoredProjects));
        localStorage.setItem('chronoRules', JSON.stringify(projectRules));
    }, [calendarImages, userMappings, ignoredProjects, projectRules]);
    
    const displayProjects = useMemo<Project[]>(() => {
        const processedEvents = calendarImages.flatMap(img => img.events).map(event => {
            const matchingRuleKey = Object.keys(projectRules).find(keyword =>
                event.title.toLowerCase().includes(keyword.toLowerCase())
            );
            return matchingRuleKey ? { ...event, title: projectRules[matchingRuleKey] } : event;
        });

        const aggregatedByOriginal: Record<string, { duration: number, color: string }> = {};
        processedEvents.forEach(event => {
            if (ignoredProjects.includes(event.title)) return;
            if (!aggregatedByOriginal[event.title]) {
                aggregatedByOriginal[event.title] = { duration: 0, color: event.color };
            }
            aggregatedByOriginal[event.title].duration += event.durationHours;
        });

        const aggregatedByDisplay: Record<string, { duration: number, color: string, originalNames: string[] }> = {};
        Object.entries(aggregatedByOriginal).forEach(([originalName, data]) => {
            const mapping = userMappings[originalName];
            const displayName = mapping?.name || originalName;
            const displayColor = mapping?.color || data.color;
            if (!aggregatedByDisplay[displayName]) {
                aggregatedByDisplay[displayName] = { duration: 0, color: displayColor, originalNames: [] };
            }
            aggregatedByDisplay[displayName].duration += data.duration;
            aggregatedByDisplay[displayName].color = displayColor;
            if (!aggregatedByDisplay[displayName].originalNames.includes(originalName)) {
                aggregatedByDisplay[displayName].originalNames.push(originalName);
            }
        });
        
        const finalProjects = Object.entries(aggregatedByDisplay).map(([name, data]) => ({ name, ...data }));
        
        const usedColors = new Set(finalProjects.map(p => p.color));
        let colorIndex = 0;
        return finalProjects.map(p => {
          const originalName = p.originalNames[0];
          if (!userMappings[originalName]?.color && p.color === '#808080') {
              while(colorIndex < COLORS.length && usedColors.has(COLORS[colorIndex])) {
                  colorIndex++;
              }
              if (colorIndex < COLORS.length) {
                  const newColor = COLORS[colorIndex];
                  usedColors.add(newColor);
                  colorIndex++;
                  return {...p, color: newColor};
              }
          }
          return p;
        });

    }, [calendarImages, userMappings, ignoredProjects, projectRules]);

    const handleImageUpload = async (file: File) => {
        setIsLoading(true);
        setLoadingText('Analyzing your calendar...');
        setError(null);
        try {
            const base64Image = await fileToBase64(file);
            const analyzedEvents = await analyzeCalendarImage(base64Image);
            const newImage: CalendarImage = { id: Date.now().toString(), base64: base64Image, events: analyzedEvents };
            setCalendarImages(prev => [...prev, newImage]);
        } catch (e: any) {
            setError(e.message || 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteImage = (id: string) => setCalendarImages(prev => prev.filter(img => img.id !== id));

    const handleUpdateProject = (originalNames: string[], newName: string, newColor: string) => {
        setUserMappings(prev => {
            const newMappings = { ...prev };
            originalNames.forEach(originalName => {
                const mapping = userMappings[originalName];
                const displayName = mapping?.name || originalName;
                if(displayName === newName) { // if only color is changed for an existing renamed project
                    Object.keys(newMappings).forEach(key => {
                        if(newMappings[key].name === displayName) {
                            newMappings[key] = { ...newMappings[key], color: newColor };
                        }
                    });
                }
                newMappings[originalName] = { name: newName, color: newColor };
            });
            return newMappings;
        });
    };

    const handleDeleteProject = (originalNames: string[]) => setIgnoredProjects(prev => [...new Set([...prev, ...originalNames])]);
    
    const handleAddRule = (keyword: string, targetProject: string) => setProjectRules(prev => ({...prev, [keyword]: targetProject}));
    const handleDeleteRule = (keyword: string) => setProjectRules(prev => {
        const newRules = {...prev};
        delete newRules[keyword];
        return newRules;
    });

    if (!isAuthenticated) return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;

    return (
        <div className="min-h-screen bg-slate-900 p-4 sm:p-6 lg:p-8">
            <main className="max-w-7xl mx-auto">
                <header className="mb-8">
                    <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">ChronoAI Dashboard</h1>
                    <p className="text-slate-400 mt-1">Your AI-powered time analysis overview.</p>
                </header>
                
                {isLoading ? (
                    <div className="flex justify-center items-center h-96"><Spinner text={loadingText} /></div>
                ) : (
                    <>
                        {error && <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-lg mb-6">{error}</div>}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-1 space-y-6">
                                <ImageUploader onImageUpload={handleImageUpload} isLoading={isLoading} />
                                <ProjectRulesManager rules={projectRules} onAddRule={handleAddRule} onDeleteRule={handleDeleteRule} />
                                <ImageManager images={calendarImages} onDelete={handleDeleteImage} />
                                <ProjectRanking projects={displayProjects} onUpdateProject={handleUpdateProject} onDeleteProject={handleDeleteProject} />
                            </div>
                            <div className="lg:col-span-2 space-y-6">
                               <div className="floating" ref={chartContainerRef}>
                                 <ProjectPieChart data={displayProjects} />
                               </div>
                               <ReportGenerator projects={displayProjects} chartContainerRef={chartContainerRef} />
                            </div>
                        </div>
                    </>
                )}
            </main>
            <Chatbot projects={displayProjects} />
        </div>
    );
}

export default App;
