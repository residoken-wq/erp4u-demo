import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiMessage } from './ai-message.entity';
import { ProductsService } from '../products/products.service';
import { FinanceService } from '../finance/finance.service';
import { SalesService } from '../sales/sales.service';
import { CustomersService } from '../customers/customers.service';
import { InventoryService } from '../inventory/inventory.service';
import { PlanningService } from '../planning/planning.service';
import { TasksService } from '../tasks/tasks.service';
import { UsersService } from '../users/users.service';
import { AiLearningService } from './ai-learning.service';
import { AiKnowledgeService } from './ai-knowledge.service';

@Injectable()
export class AiService {
    constructor(
        @InjectRepository(AiMessage) private aiMessageRepo: Repository<AiMessage>,
        private configService: ConfigService,
        private productsService: ProductsService,
        private financeService: FinanceService,
        private salesService: SalesService,
        private customersService: CustomersService,
        private inventoryService: InventoryService,
        private planningService: PlanningService,
        private tasksService: TasksService,
        private usersService: UsersService,
        private aiLearningService: AiLearningService,
        private aiKnowledgeService: AiKnowledgeService,
    ) {}

    private selectedModel: string | null = null;

    // Conversation history: Map<userId, messages[]>
    private conversationHistory: Map<string, Array<{ role: string; content: string }>> = new Map();
    private readonly MAX_HISTORY = 10; // Keep last 10 messages

    private getConversationHistory(userId: string): Array<{ role: string; content: string }> {
        if (!this.conversationHistory.has(userId)) {
            this.conversationHistory.set(userId, []);
        }
        return this.conversationHistory.get(userId);
    }

    private addToHistory(userId: string, role: string, content: string) {
        const history = this.getConversationHistory(userId);
        history.push({ role, content });

        // Keep only last MAX_HISTORY messages
        if (history.length > this.MAX_HISTORY) {
            history.shift();
        }
    }

    private clearHistory(userId: string) {
        this.conversationHistory.delete(userId);
    }

    private formatNumber(num: number): string {
        return num.toLocaleString('vi-VN');
    }

    private formatMoney(amount: number): string {
        return amount.toLocaleString('vi-VN');
    }

    private async getBestModel(apiKey: string): Promise<string> {
        if (this.selectedModel) return this.selectedModel;

        try {
            const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`;
            const response = await fetch(listUrl);
            const data = await response.json();

            if (!data.models) {
                console.error('DEBUG AI: Failed to list models', data);
                return 'models/gemini-1.5-flash';
            }

            const models = data.models.filter((m: any) =>
                m.supportedGenerationMethods?.includes('generateContent')
            );

            console.log('DEBUG AI: Available models:', models.map((m: any) => m.name));

            const preferred = models.find((m: any) => m.name.includes('flash')) || models[0];

            if (preferred) {
                console.log('DEBUG AI: Auto-selected model:', preferred.name);
                this.selectedModel = preferred.name;
                return this.selectedModel;
            }
        } catch (e) {
            console.error('DEBUG AI: Error listing models:', e);
        }

        return 'models/gemini-1.5-flash';
    }

    private async callGemini(prompt: string): Promise<string> {
        let apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) throw new Error("GEMINI_API_KEY not set");
        apiKey = apiKey.trim();

        const modelName = await this.getBestModel(apiKey);
        const url = `https://generativelanguage.googleapis.com/v1/${modelName}:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }]
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.text();
                if (response.status === 404) {
                    this.selectedModel = null;
                }
                throw new Error(`Gemini API Error (${modelName}): ${response.status} - ${err}`);
            }

            const data = await response.json();
            // Parse prediction
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } catch (error) {
            console.error("Gemini Fetch Error:", error);
            throw error;
        }
    }

    // --- TOOLS DEFINITION ---
    // In a real production app, these schemas would be passed to the LLM.
    // Since Gemini Function Calling API setup can be verbose, we will use a "ReAct" style or simplified JSON mode first.
    // UPDATED STRATEGY: We will just prompt the LLM to output a JSON Action.

    async chat(body: any) {
        const { message, userId = 'default' } = body; // Default userId if not provided

        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        console.log('DEBUG AI: Checking Key...');
        console.log('DEBUG AI: Key from ConfigService:', apiKey ? 'FOUND (Length: ' + apiKey.length + ')' : 'MISSING');
        console.log('DEBUG AI: Process.env.GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'FOUND' : 'MISSING');

        if (!apiKey) {
            return { text: "AI Service is not configured (Missing GEMINI_API_KEY)." };
        }

        // SYSTEM PROMPT with enhanced context
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        // Get conversation history
        const history = this.getConversationHistory(userId);
        const historyContext = history.length > 0
            ? `\n\nCONVERSATION HISTORY:\n${history.map(h => `${h.role}: ${h.content}`).join('\n')}\n`
            : '';

        // Get learned examples
        const learnedExamples = await this.aiLearningService.getTopExamples(5);
        const learnedContext = learnedExamples.length > 0
            ? `\n\nLEARNED EXAMPLES (Prioritize these patterns):\n${learnedExamples.map(e => `- User asks: "${e.question_pattern}" -> Output: ${JSON.stringify(e.expected_args)}`).join('\n')}\n`
            : '';

        const knowledgeContext = this.aiKnowledgeService.getKnowledgeContext();

        const prompt = `
            You are ERP4UBot, an intelligent assistant for the ERP4U system in Vietnam.
            Current date: ${now.toISOString().split('T')[0]} (Month: ${currentMonth}, Year: ${currentYear})
            
            Your job is to help the user manage Inventory, Finance, and Sales.
            You MUST respond in Vietnamese when the user speaks Vietnamese.
            
            ${knowledgeContext}

            CRITICAL RULES:
            1. When user asks about "tháng [số]" (month X) without year, assume they mean the CURRENT YEAR (${currentYear})
            2. When user asks "tháng này" (this month), use month ${currentMonth} and year ${currentYear}
            3. When user asks "tháng trước" (last month), calculate the previous month correctly
            4. Output ONLY a valid JSON object, NO markdown code blocks, NO text before or after
            5. Use conversation history to understand context when the user asks follow-up questions
            ${learnedContext}
            
            AVAILABLE TOOLS:
            1. CHECK_STOCK: Search for products and check their stock.
               Output: { "tool": "CHECK_STOCK", "query": "product name or sku" }
               Example: User says "kho còn iphone không?" → { "tool": "CHECK_STOCK", "query": "iphone" }
            
            2. CHECK_FINANCE: Get financial report for a specific period.
               Output: { "tool": "CHECK_FINANCE", "month": number, "year": number }
               
               CRITICAL: Detect if user wants YEARLY or MONTHLY report:
               - If user says "năm", "cả năm", "toàn năm", "thống kê năm" → set month = 0
               - If user says "tháng [số]" or specific month → set month = 1-12
               
               Yearly examples (month = 0):
               - "thống kê doanh thu năm 2025" → { "tool": "CHECK_FINANCE", "month": 0, "year": 2025 }
               - "doanh thu cả năm 2024" → { "tool": "CHECK_FINANCE", "month": 0, "year": 2024 }
               - "báo cáo tài chính năm 2025" → { "tool": "CHECK_FINANCE", "month": 0, "year": 2025 }
               
               Monthly examples (month = 1-12):
               - "doanh thu tháng 12" → { "tool": "CHECK_FINANCE", "month": 12, "year": ${currentYear} }
               - "doanh thu tháng này" → { "tool": "CHECK_FINANCE", "month": ${currentMonth}, "year": ${currentYear} }
               - "báo cáo tài chính tháng 3/2024" → { "tool": "CHECK_FINANCE", "month": 3, "year": 2024 }

            3. CREATE_LEAD: Create a new CRM lead.
               Output: { "tool": "CREATE_LEAD", "name": "customer name", "phone": "phone number" }
               Example: "khách tên Tùng sdt 0909123456" → { "tool": "CREATE_LEAD", "name": "Tùng", "phone": "0909123456" }

            4. CHECK_ORDER: Search for sales orders.
               Output: { "tool": "CHECK_ORDER", "query": "customer name or order code" }
               Example: "tìm đơn của khách Tùng" → { "tool": "CHECK_ORDER", "query": "Tùng" }

            5. GET_PRODUCT_INFO: Get detailed product information.
               Output: { "tool": "GET_PRODUCT_INFO", "sku": "product sku" }
               Example: "thông tin sản phẩm PRD-001" → { "tool": "GET_PRODUCT_INFO", "sku": "PRD-001" }

            6. SEARCH_CUSTOMER: Find customer contact information.
               Output: { "tool": "SEARCH_CUSTOMER", "query": "customer name or phone" }
               Example: "tìm khách hàng Lan" → { "tool": "SEARCH_CUSTOMER", "query": "Lan" }

            7. CHECK_MRP: Check production planning suggestions.
               Output: { "tool": "CHECK_MRP" }
               Example: "kiểm tra kế hoạch sản xuất" → { "tool": "CHECK_MRP" }

            8. CREATE_TASK: Create a new task or reminder.
               Output: { "tool": "CREATE_TASK", "title": "task title", "assignee_name": "name of assignee", "due_date": "YYYY-MM-DD HH:mm" }
               Example: "nhắc Tùng gọi khách A vào 14h chiều mai" → { "tool": "CREATE_TASK", "title": "Gọi lại khách A", "assignee_name": "Tùng", "due_date": "2025-10-20 14:00" }
               Note: If no time specified, assume tomorrow 9AM.

            9. CHECK_TASKS: Search for tasks.
               Output: { "tool": "CHECK_TASKS", "query": "keyword" }
               Example: "kiểm tra công việc của Tùng" → { "tool": "CHECK_TASKS", "query": "Tùng" }

            10. UNKNOWN: If you cannot help.
               Output: { "tool": "UNKNOWN", "reply": "Xin lỗi, tôi chưa hiểu yêu cầu này." }

            11. QUERY_ORDERS_ADVANCED: Lọc đơn hàng theo tháng, trạng thái thanh toán (UNPAID, PAID, PARTIAL_PAID), trạng thái đơn.
               Output: { "tool": "QUERY_ORDERS_ADVANCED", "month": number, "paymentStatus": "UNPAID" | "PAID" | "PARTIAL_PAID", "status": string }
               Example: "liệt kê các đơn hàng tháng 5 chưa thanh toán đủ" -> { "tool": "QUERY_ORDERS_ADVANCED", "month": 5, "paymentStatus": "UNPAID" }

            USER MESSAGE: "${message}"
            
            Remember: Output ONLY the JSON object, nothing else.
        `;

        try {
            // CALL GEMINI via FETCH
            const textHTML = await this.callGemini(prompt);

            // Clean markdown if present
            const cleanJson = textHTML.replace(/```json/g, '').replace(/```/g, '').trim();

            let action;
            try {
                action = JSON.parse(cleanJson);
                console.log('DEBUG AI: Parsed action from LLM:', JSON.stringify(action));
            } catch (e) {
                // If LLM replies with text, return it
                console.log('DEBUG AI: Failed to parse JSON, returning raw text:', textHTML);
                return { text: textHTML };
            }

            // EXECUTE TOOL
            if (action.tool === 'CHECK_STOCK') {
                const products = await this.productsService.searchProducts(action.query);
                if (products.length === 0) {
                    const reply = `Không tìm thấy sản phẩm nào khớp với "${action.query}".`;
                    this.addToHistory(userId, 'user', message);
                    this.addToHistory(userId, 'assistant', reply);
                    return { text: reply };
                }

                const details = products.map(p => `- ${p.name} (${p.sku}): Còn ${this.formatNumber(p.quantity_in_stock)} ${p.unit || 'cái'}`).join('\n');
                const reply = `Kết quả tìm kiếm cho "${action.query}":\n${details}`;
                this.addToHistory(userId, 'user', message);
                this.addToHistory(userId, 'assistant', reply);
                return { text: reply };
            }

            if (action.tool === 'CHECK_FINANCE') {
                // Fix: Check for month 0 (yearly stats) explicitly since 0 is falsy
                const m = (action.month !== undefined && action.month !== null)
                    ? action.month
                    : new Date().getMonth() + 1;
                const y = action.year || new Date().getFullYear();

                // Handle yearly statistics (month = 0)
                if (m === 0) {
                    let totalIncome = 0;
                    let totalExpense = 0;
                    let totalProfit = 0;

                    console.log(`DEBUG AI: Aggregating year ${y} statistics...`);

                    // Aggregate all 12 months
                    for (let month = 1; month <= 12; month++) {
                        const dateStr = `${y}-${String(month).padStart(2, '0')}`;
                        try {
                            const monthReport = await this.financeService.getFinancialReport(dateStr);
                            console.log(`DEBUG AI: Month ${month}/${y} - Income: ${monthReport.summary.income}, Expense: ${monthReport.summary.expense}, Profit: ${monthReport.summary.profit}`);
                            totalIncome += monthReport.summary.income || 0;
                            totalExpense += monthReport.summary.expense || 0;
                            totalProfit += monthReport.summary.profit || 0;
                        } catch (e) {
                            console.log(`DEBUG AI: Month ${month}/${y} - No data or error: ${e.message}`);
                        }
                    }

                    console.log(`DEBUG AI: Year ${y} totals - Income: ${totalIncome}, Expense: ${totalExpense}, Profit: ${totalProfit}`);

                    const reply = `Báo cáo tài chính năm ${y}:\n` +
                        `- Tổng doanh thu: ${this.formatMoney(totalIncome)} đ\n` +
                        `- Tổng chi phí: ${this.formatMoney(totalExpense)} đ\n` +
                        `- Tổng lợi nhuận: ${this.formatMoney(totalProfit)} đ`;
                    this.addToHistory(userId, 'user', message);
                    this.addToHistory(userId, 'assistant', reply);
                    return { text: reply };
                }

                // Handle monthly statistics
                const dateStr = `${y}-${String(m).padStart(2, '0')}`;
                const report = await this.financeService.getFinancialReport(dateStr);
                const reply = `Báo cáo tháng ${m}/${y}:\n- Doanh thu: ${this.formatMoney(report.summary.income)} đ\n- Lợi nhuận: ${this.formatMoney(report.summary.profit)} đ`;
                this.addToHistory(userId, 'user', message);
                this.addToHistory(userId, 'assistant', reply);
                return { text: reply };
            }

            if (action.tool === 'CREATE_LEAD') {
                const code = `LEAD-${Date.now().toString().slice(-6)}`;
                await this.customersService.create({
                    code,
                    name: action.name,
                    phone: action.phone,
                    type: 'LEAD',
                    lead_status: 'NEW'
                });
                const reply = `Đã tạo Lead mới: ${action.name} (SĐT: ${action.phone}).`;
                this.addToHistory(userId, 'user', message);
                this.addToHistory(userId, 'assistant', reply);
                return { text: reply };
            }

            if (action.tool === 'CHECK_ORDER') {
                // Sử dụng hàm SQL mới thay vì load all
                const orders = await this.salesService.findOrdersByFilters({ customerName: action.query });

                if (!orders || orders.length === 0) {
                    const reply = `Không tìm thấy đơn hàng nào khớp với "${action.query}".`;
                    this.addToHistory(userId, 'user', message);
                    this.addToHistory(userId, 'assistant', reply);
                    return { text: reply };
                }

                const details = orders.slice(0, 5).map((o: any) => {
                    const customerName = o.customer?.name || 'N/A';
                    const total = this.formatMoney(o.total_amount || 0);
                    return `- ${o.order_code}: ${customerName} - ${total} đ (${o.status})`;
                }).join('\n');
                const reply = `Tìm thấy ${orders.length} đơn hàng:\n${details}`;
                this.addToHistory(userId, 'user', message);
                this.addToHistory(userId, 'assistant', reply);
                return { text: reply };
            }

            if (action.tool === 'QUERY_ORDERS_ADVANCED') {
                const orders = await this.salesService.findOrdersByFilters({
                    month: action.month,
                    year: action.year || new Date().getFullYear(),
                    paymentStatus: action.paymentStatus,
                    status: action.status
                });

                if (!orders || orders.length === 0) {
                    const reply = `Không có đơn hàng nào thỏa mãn điều kiện tìm kiếm.`;
                    this.addToHistory(userId, 'user', message);
                    this.addToHistory(userId, 'assistant', reply);
                    return { text: reply };
                }

                const details = orders.slice(0, 10).map((o: any) => {
                    const customerName = o.customer?.name || 'N/A';
                    const total = this.formatMoney(o.total_amount || 0);
                    const paid = this.formatMoney(o.paid_amount || 0);
                    const remaining = this.formatMoney((o.total_amount || 0) - (o.paid_amount || 0));
                    return `- ${o.order_code}: ${customerName} - Tổng: ${total}đ - Đã thu: ${paid}đ - Còn lại: ${remaining}đ (${o.payment_status})`;
                }).join('\n');
                const reply = `Đã tìm thấy ${orders.length} đơn hàng:\n${details}`;
                this.addToHistory(userId, 'user', message);
                this.addToHistory(userId, 'assistant', reply);
                return { text: reply };
            }


            if (action.tool === 'GET_PRODUCT_INFO') {
                const product = await this.productsService.findOneBySku(action.sku);
                if (!product) {
                    const reply = `Không tìm thấy sản phẩm với SKU "${action.sku}".`;
                    this.addToHistory(userId, 'user', message);
                    this.addToHistory(userId, 'assistant', reply);
                    return { text: reply };
                }

                const reply = `Thông tin sản phẩm ${product.sku}:\n` +
                    `- Tên: ${product.name}\n` +
                    `- Loại: ${product.product_type || 'N/A'}\n` +
                    `- Giá: ${this.formatMoney(product.base_price)} đ\n` +
                    `- Tồn kho: ${this.formatNumber(product.quantity_in_stock)} ${product.unit || 'cái'}`;
                this.addToHistory(userId, 'user', message);
                this.addToHistory(userId, 'assistant', reply);
                return { text: reply };
            }

            if (action.tool === 'SEARCH_CUSTOMER') {
                const customers = await this.customersService.searchCustomersAdvanced(action.query);


                if (!customers || customers.length === 0) {
                    const reply = `Không tìm thấy khách hàng nào khớp với "${action.query}".`;
                    this.addToHistory(userId, 'user', message);
                    this.addToHistory(userId, 'assistant', reply);
                    return { text: reply };
                }

                const details = customers.slice(0, 5).map((c: any) =>
                    `- ${c.name} (${c.code}): ${c.phone || 'N/A'} - ${c.email || 'N/A'}`
                ).join('\n');
                const reply = `Tìm thấy ${customers.length} khách hàng:\n${details}`;
                this.addToHistory(userId, 'user', message);
                this.addToHistory(userId, 'assistant', reply);
                return { text: reply };
            }

            if (action.tool === 'CHECK_MRP') {
                try {
                    const suggestions = await this.planningService.getSuggestion();
                    if (suggestions.length === 0) {
                        const reply = "Hiện tại không có đơn hàng nào cần lên kế hoạch sản xuất.";
                        this.addToHistory(userId, 'user', message);
                        this.addToHistory(userId, 'assistant', reply);
                        return { text: reply };
                    }

                    const details = suggestions.slice(0, 5).map(o =>
                        `- Đơn ${o.order_code} (${o.customer?.name}): Giao ${new Date(o.delivery_date).toLocaleDateString('vi-VN')}`
                    ).join('\n');

                    const reply = `Có ${suggestions.length} đơn hàng cần lập kế hoạch sản xuất:\n${details}`;
                    this.addToHistory(userId, 'user', message);
                    this.addToHistory(userId, 'assistant', reply);
                    return { text: reply };
                } catch (e) {
                    return { text: "Lỗi kiểm tra MRP: " + e.message };
                }
            }

            if (action.tool === 'CHECK_TASKS') {
                const allTasks = await this.tasksService.findAll();
                const tasks = allTasks.filter((t: any) =>
                    t.title?.toLowerCase().includes(action.query.toLowerCase()) ||
                    t.assignee?.full_name?.toLowerCase().includes(action.query.toLowerCase())
                );

                if (tasks.length === 0) {
                    const reply = `Không tìm thấy công việc nào liên quan đến "${action.query}".`;
                    this.addToHistory(userId, 'user', message);
                    this.addToHistory(userId, 'assistant', reply);
                    return { text: reply };
                }

                const details = tasks.slice(0, 5).map((t: any) =>
                    `- [${t.status}] ${t.title} (Giao: ${t.assignee?.full_name || 'Chưa gán'}) - Hạn: ${t.due_date ? new Date(t.due_date).toLocaleDateString('vi-VN') : 'N/A'}`
                ).join('\n');

                const reply = `Tìm thấy ${tasks.length} công việc:\n${details}`;
                this.addToHistory(userId, 'user', message);
                this.addToHistory(userId, 'assistant', reply);
                return { text: reply };
            }

            if (action.tool === 'CREATE_TASK') {
                // 1. Find Assignee ID
                let assigneeId = null;
                let assigneeName = 'Bạn';

                if (action.assignee_name) {
                    const allUsers = await this.usersService.getAllUsers();

                    // Simple fuzzy search
                    const user = allUsers.find(u =>
                        u.full_name?.toLowerCase().includes(action.assignee_name.toLowerCase()) ||
                        u.username?.toLowerCase().includes(action.assignee_name.toLowerCase())
                    );

                    if (user) {
                        assigneeId = user.id;
                        assigneeName = user.full_name;
                    } else {
                        // Fallback to current user if exact match not found? Or just leave null?
                        // decided: warn user but create task anyway unassigned or assigned to self?
                        // Better: respond error
                        const reply = `Không tìm thấy nhân viên nào tên "${action.assignee_name}". Vui lòng kiểm tra lại.`;
                        this.addToHistory(userId, 'user', message);
                        this.addToHistory(userId, 'assistant', reply);
                        return { text: reply };
                    }
                } else {
                    // Assign to creator (need to map userId to numeric ID? Assuming userId passed is NOT numeric id)
                    // TODO: Need robust user resolution. For now, try to find by userId if it looks like username
                    const u = await this.usersService.findOneByUsernameForAuth(userId);
                    if (u) assigneeId = u.id;
                }

                await this.tasksService.create({
                    title: action.title,
                    description: `Được tạo bởi ERP4UBot theo yêu cầu: "${message}"`,
                    status: 'TODO',
                    priority: 'MEDIUM',
                    assignee_id: assigneeId,
                    due_date: action.due_date || new Date(Date.now() + 86400000), // Default +1 day
                    creator_id: assigneeId // Self-created for now if unknown
                });

                const reply = `Đã tạo công việc "${action.title}" cho ${assigneeName}.`;
                this.addToHistory(userId, 'user', message);
                this.addToHistory(userId, 'assistant', reply);
                return { text: reply };
            }

            const reply = action.reply || "Tôi không hiểu yêu cầu này.";
            this.addToHistory(userId, 'user', message);
            this.addToHistory(userId, 'assistant', reply);
            return { text: reply };

        } catch (error) {
            console.error(error);
            return { text: "Lỗi xử lý AI: " + error.message };
        }
    }

    async suggestPrice(dto: any) {
        // ... (Keep existing logic)
        const { cost_price, competitor_price, strategy, market_volume } = dto;
        const cost = Number(cost_price) || 0;
        const comp = Number(competitor_price) || 0;

        let suggested = cost * 1.3; // Default 30% margin
        let min_price = cost * 1.1; // Min margin 10%
        let explanation = "";

        if (comp > 0) {
            if (strategy === 'AGGRESSIVE') {
                // Thấp hơn đối thủ 5%
                suggested = comp * 0.95;
                explanation = "Chiến lược Cạnh Tranh: Đặt giá thấp hơn đối thủ 5% để chiếm thị phần.";
                if (suggested < min_price) {
                    suggested = min_price;
                    explanation += " Tuy nhiên, đã điều chỉnh về mức hòa vốn tối thiểu.";
                }
            } else if (strategy === 'PROFIT') {
                // Cao hơn đối thủ 10% nếu brand tốt, hoặc Cost + 50%
                suggested = Math.max(cost * 1.5, comp * 1.1);
                explanation = "Chiến lược Lợi Nhuận: Tập trung vào biên lợi nhuận cao (50%) hoặc định vị cao cấp hơn đối thủ.";
            } else {
                // BALANCED: Trung bình
                const target = Math.min(comp, cost * 1.4);
                suggested = target;
                explanation = "Chiến lược Cân Bằng: Giữ mức giá cạnh tranh nhưng vẫn đảm bảo biên lợi nhuận an toàn (40%).";
            }
        } else {
            // Không có giá đối thủ
            if (strategy === 'AGGRESSIVE') {
                suggested = cost * 1.2;
                explanation = "Biên lợi nhuận mỏng (20%) để thâm nhập thị trường.";
            } else if (strategy === 'PROFIT') {
                suggested = cost * 1.6;
                explanation = "Biên lợi nhuận dày (60%) tối đa hóa dòng tiền.";
            } else {
                suggested = cost * 1.35;
                explanation = "Mức giá tiêu chuẩn (Mark-up 35%).";
            }
        }

        // Logic volume
        if (market_volume === 'HIGH') {
            suggested *= 0.95; // Giảm thêm 5% nếu volume lớn
            explanation += " (Đã giảm 5% do volume thị trường lớn)";
        }

        // Rounding to 1000
        suggested = Math.ceil(suggested / 1000) * 1000;
        min_price = Math.ceil(min_price / 1000) * 1000;

        // Generate tiered pricing
        return {
            price_100: suggested,
            price_50: Math.ceil((suggested * 1.05) / 1000) * 1000,
            price_30: Math.ceil((suggested * 1.10) / 1000) * 1000,
            min_price: min_price,
            explanation: explanation
        };
    }

    // --- LEAD CARE: SUGGEST REPLY ---
    async suggestReply(dto: any) {
        const { customerId, chatHistory, customerName, products } = dto;

        // Build context from chat history
        const historyText = chatHistory && chatHistory.length > 0
            ? chatHistory.slice(-10).map((c: any) =>
                `[${c.sender_type}] ${c.sender_name}: ${c.content.replace(/<[^>]+>/g, '')}`
            ).join('\n')
            : 'Chưa có lịch sử chat.';

        // Build product context
        let productContext = 'Không có thông tin sản phẩm.';
        if (products && products.length > 0) {
            productContext = products.slice(0, 5).map((p: any) =>
                `- ${p.name}: ${this.formatMoney(p.price || 0)} (SL tồn: ${p.stock || 'N/A'})`
            ).join('\n');
        }

        const prompt = `Bạn là nhân viên chăm sóc khách hàng chuyên nghiệp của công ty.

THÔNG TIN KHÁCH HÀNG:
- Tên: ${customerName || 'N/A'}

LỊCH SỬ TRAO ĐỔI GẦN ĐÂY:
${historyText}

THÔNG TIN SẢN PHẨM:
${productContext}

HÃY GỢI Ý MỘT CÂU TRẢ LỜI CHO KHÁCH HÀNG:
- Lịch sự, chuyên nghiệp
- Ngắn gọn, đi thẳng vào vấn đề
- Nếu khách hỏi về giá, có thể tham khảo thông tin sản phẩm trên
- Trả lời bằng tiếng Việt

Chỉ trả về nội dung gợi ý, không giải thích thêm.`;

        try {
            const reply = await this.callGemini(prompt);
            return { suggestion: reply.trim() };
        } catch (e) {
            return { suggestion: 'Xin chào! Cảm ơn bạn đã liên hệ. Tôi có thể giúp gì cho bạn?' };
        }
    }

    // --- CUSTOMER 360: AI COMPREHENSIVE SUMMARIZE (BG, SO, PFO, CRM) ---
    async summarizeCustomer360(customerId: number) {
        const data = await this.customersService.getPortrait360Data(customerId);
        if (!data || !data.customer) {
            throw new Error('Không tìm thấy thông tin khách hàng');
        }

        const { customer, summary, quotations, sales_orders, pfos, comments } = data;

        // Build quotation text
        const quotationsText = quotations.length > 0
            ? quotations.slice(0, 10).map((q: any) => 
                `- Báo giá #${q.order_code} (${new Date(q.order_date).toLocaleDateString('vi-VN')}): ${this.formatMoney(q.total_amount)} VNĐ [Trạng thái: ${q.status}]`
              ).join('\n')
            : 'Chưa có lịch sử Báo giá (BG).';

        // Build sales order text
        const ordersText = sales_orders.length > 0
            ? sales_orders.slice(0, 10).map((s: any) => {
                const itemSummary = (s.items || []).map((i: any) => `${i.product_name} (SL: ${i.quantity})`).join(', ');
                return `- Đơn hàng #${s.order_code} (${new Date(s.order_date).toLocaleDateString('vi-VN')}): Tổng ${this.formatMoney(s.total_amount)} VNĐ, Đã TT: ${this.formatMoney(s.paid_amount)} VNĐ, Nợ: ${this.formatMoney(s.remaining_debt)} VNĐ [TT: ${s.status}] -> Mặt hàng: ${itemSummary || 'N/A'}`;
              }).join('\n')
            : 'Chưa có đơn hàng chính thức (SO).';

        // Build PFO text
        const pfosText = pfos.length > 0
            ? pfos.slice(0, 10).map((p: any) => 
                `- Lệnh SX #${p.code} (Gắn đơn SO ID: ${p.sales_order_id}): SL: ${p.quantity}, Trạng thái: ${p.status}, Rủi ro: ${p.risk_status || 'GREEN'}`
              ).join('\n')
            : 'Chưa có kế hoạch / lệnh sản xuất (PFO).';

        // Build comments text
        const commentsText = comments.length > 0
            ? comments.slice(0, 8).map((c: any) => 
                `[${new Date(c.created_at).toLocaleDateString('vi-VN')} - ${c.sender_name || 'NV'}]: ${c.content.replace(/<[^>]+>/g, '')}`
              ).join('\n')
            : 'Chưa có ghi chú trao đổi.';

        // Build top products
        const topProductsText = summary.top_products.length > 0
            ? summary.top_products.map((p: any) => `- ${p.name}: Tổng SL ${p.quantity}, Doanh thu ${this.formatMoney(p.subtotal)} VNĐ`).join('\n')
            : 'Chưa có dữ liệu mua sản phẩm.';

        const prompt = `Bạn là Giám đốc Chăm sóc Khách hàng & Phân tích Dữ liệu Doanh nghiệp ERP cao cấp (Senior CRM & AI Analyst).
Nhiệm vụ của bạn là tổng hợp và phân tích bức tranh "CHÂN DUNG KHÁCH HÀNG 360°" toàn diện dựa trên dữ liệu thực tế từ hệ thống ERP: Báo giá (BG), Đơn hàng (SO), Kế hoạch sản xuất (PFO), Lịch sử chăm sóc và Ghi chú nội bộ.

===============================
DỮ LIỆU KHÁCH HÀNG TỪ HỆ THỐNG:
===============================
1. HỒ SƠ CƠ BẢN:
- Tên khách hàng: ${customer.name} (Mã: ${customer.code})
- Phân loại: ${customer.type === 'CUSTOMER' ? 'Khách hàng chính thức' : 'Lead / Khách hàng tiềm năng'}
- Trạng thái Lead: ${customer.lead_status || 'N/A'} | Nguồn: ${customer.lead_source || 'N/A'}
- Giá trị dự kiến: ${this.formatMoney(customer.potential_value || 0)} VNĐ
- Địa chỉ: ${customer.address || ''} ${customer.province ? `(${customer.province})` : ''}
- Người phụ trách: ${customer.assigned_to?.name || 'Chưa phân công'}
- Hạn mức nợ: ${this.formatMoney(customer.credit_limit || 0)} VNĐ

2. TỔNG QUAN CHỈ SỐ KINH DOANH (RFM & CONVERSION):
- Tổng số Báo giá (BG) đã gửi: ${summary.total_quotations} (Tổng giá trị: ${this.formatMoney(summary.total_quotations_amount)} VNĐ)
- Tổng số Đơn hàng (SO) đã chốt: ${summary.total_orders} (Doanh thu lũy kế: ${this.formatMoney(summary.total_revenue)} VNĐ)
- Đã thanh toán: ${this.formatMoney(summary.total_paid)} VNĐ | Công nợ hiện tại: ${this.formatMoney(summary.total_debt)} VNĐ
- Tỷ lệ chốt đơn (Win rate BG -> SO): ${summary.win_rate}%
- Giá trị trung bình mỗi đơn (AOV): ${this.formatMoney(summary.avg_order_value)} VNĐ

3. TOP SẢN PHẨM KHÁCH HÀNG HAY ĐẶT:
${topProductsText}

4. LỊCH SỬ BÁO GIÁ (BG):
${quotationsText}

5. LỊCH SỬ ĐƠN HÀNG (SO):
${ordersText}

6. TÌNH HÌNH THỰC HIỆN SẢN XUẤT (PFO):
- Tổng số PFO: ${summary.pfo_summary.total} (Đang sản xuất/Gia công: ${summary.pfo_summary.in_production}, Đã hoàn thành: ${summary.pfo_summary.completed}, Rủi ro/Chậm trễ: ${summary.pfo_summary.risk_count})
Chi tiết:
${pfosText}

7. LỊCH SỬ TRAO ĐỔI / CHĂM SÓC (CRM):
${commentsText}

8. GHI CHÚ ĐẶC THÙ ĐÃ LƯU TRƯỚC ĐÓ:
${customer.portrait_notes ? customer.portrait_notes.replace(/<[^>]+>/g, '') : 'Chưa có ghi chú.'}

===============================
YÊU CẦU ĐẦU RA BẢN TỔNG HỢP 360°:
===============================
Hãy lập bản phân tích Chân dung 360° khách hàng bằng Tiếng Việt rõ ràng, súc tích, chuyên nghiệp, sử dụng định dạng Markdown đẹp mắt với các icon và tiêu đề theo đúng 5 phần sau:

### 1. 🌟 Tổng quan & Phân khúc Khách hàng (Customer Persona)
- Đánh giá vị thế & phân loại khách hàng (VIP / Khách hàng thân thiết / Tiềm năng cao / Cần phục hồi / Mới tiếp cận).
- Tóm tắt nhanh quy mô doanh thu, tỷ lệ chốt và mức độ gắn bó.

### 2. 📊 Phân tích Báo giá (BG) & Hành vi Đơn hàng (SO)
- Nhận xét về tỷ lệ chuyển đổi từ Báo giá sang Đơn hàng thực tế.
- Nhận diện các dòng sản phẩm chủ lực mà khách hàng ưa chuộng và chu kỳ đặt hàng (đều đặn, theo đợt vụ mùa hay phát sinh đột xuất).

### 3. 🏭 Tiến độ & Vận hành Sản xuất (PFO Health)
- Đánh giá khả năng đáp ứng đơn hàng và tiến độ thực hiện các lệnh sản xuất (PFO) cho khách hàng này.
- Có đơn nào gặp rủi ro chậm tiến độ hoặc yêu cầu gia công đặc biệt cần lưu ý không?

### 4. ⚠️ Đánh giá Rủi ro & Điểm Nhạy cảm
- Tình trạng công nợ so với hạn mức tín dụng.
- Các yêu cầu kỹ thuật khắt khe, thói quen giao nhận, hoặc phản hồi của khách trong quá khứ cần chú ý để tránh sai sót.

### 5. 🚀 Khuyến nghị Hành động Tiếp theo (Next Best Actions)
- Đề xuất 2-3 hành động cụ thể ngay cho nhân viên Kinh doanh (Sales) và Chăm sóc Khách hàng (CSKH) để gia tăng doanh số, chốt các báo giá mở, hoặc cải thiện trải nghiệm khách hàng.`;

        let summaryText = '';
        try {
            summaryText = await this.callGemini(prompt);
        } catch (e) {
            console.error('Error calling Gemini for 360 summary:', e);
            // Fallback statistical summary if AI service is not reachable
            summaryText = `### 1. 🌟 Tổng quan & Phân khúc Khách hàng
- **Khách hàng:** **${customer.name}** (${customer.code}) - ${customer.type === 'CUSTOMER' ? 'Khách hàng chính thức' : 'Khách hàng tiềm năng (Lead)'}.
- **Tổng doanh thu:** **${this.formatMoney(summary.total_revenue)} VNĐ** qua **${summary.total_orders}** đơn hàng SO.
- **Tỷ lệ chuyển đổi BG -> SO:** **${summary.win_rate}%** (${summary.total_quotations} Báo giá đã gửi).

### 2. 📊 Phân tích Báo giá (BG) & Đơn hàng (SO)
- **Giá trị trung bình đơn hàng (AOV):** **${this.formatMoney(summary.avg_order_value)} VNĐ/đơn**.
- **Sản phẩm chủ lực:** ${summary.top_products.map((p: any) => `${p.name} (SL: ${p.quantity})`).join(', ') || 'Chưa có thông tin'}.

### 3. 🏭 Tiến độ Sản xuất (PFO)
- **Tổng lệnh sản xuất (PFO):** **${summary.pfo_summary.total}** lệnh.
- Đang gia công/sản xuất: **${summary.pfo_summary.in_production}** | Đã hoàn tất: **${summary.pfo_summary.completed}** | Cảnh báo rủi ro: **${summary.pfo_summary.risk_count}**.

### 4. ⚠️ Đánh giá Công nợ & Rủi ro
- **Đã thanh toán:** ${this.formatMoney(summary.total_paid)} VNĐ (${summary.total_revenue > 0 ? Math.round((summary.total_paid / summary.total_revenue) * 100) : 100}%).
- **Công nợ hiện tại:** **${this.formatMoney(summary.total_debt)} VNĐ** (Hạn mức cho phép: ${this.formatMoney(customer.credit_limit || 0)} VNĐ).

### 5. 🚀 Khuyến nghị Hành động
- Kiểm tra lại các báo giá đang chờ phê duyệt để liên hệ thúc đẩy chốt đơn.
- Phối hợp xưởng sản xuất theo dõi tiến độ các PFO đang chạy để bàn giao đúng hẹn.`;
        }

        return {
            customer_id: customerId,
            customer_name: customer.name,
            summary: summaryText.trim(),
            generated_at: new Date().toISOString(),
            raw_data: data
        };
    }

    // --- RECRUITMENT: AI EVALUATION ---
    async evaluateAssessment(prompt: string): Promise<any> {
        try {
            const reply = await this.callGemini(prompt);
            const cleanJson = reply.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (e) {
            console.error('AI Evaluate Error:', e);
            return null;
        }
    }

    // Helper to parse CV from URL
    async parseCvUrl(cvUrl: string): Promise<string> {
        if (!cvUrl || !cvUrl.startsWith('http')) return cvUrl || '';
        try {
            const res = await fetch(cvUrl);
            const buffer = await res.arrayBuffer();
            if (cvUrl.toLowerCase().endsWith('.pdf')) {
                const pdfParse = require('pdf-parse');
                const data = await pdfParse(Buffer.from(buffer));
                return data.text;
            } else {
                // Return URL for Gemini multimodal if supported, else return empty or basic
                return cvUrl;
            }
        } catch (e) {
            console.error('Lỗi đọc nội dung CV:', e);
            return cvUrl;
        }
    }

    // Feature 1: AI Generate 10 STAR Questions
    async generateRecruitmentQuestions(jdText: string, cvUrlOrText: string): Promise<any> {
        const cvContent = await this.parseCvUrl(cvUrlOrText);
        const prompt = `
### ROLE: Chuyên gia Phỏng Vấn Tuyển Dụng cao cấp (Senior Talent Acquisition).
### TASK: Tạo 10 câu hỏi phỏng vấn dựa trên Mô tả công việc (JD) và CV ứng viên.

Job Description: ${jdText}
Candidate CV Summary/Content: ${cvContent || 'N/A'}

### YÊU CẦU:
1. Tạo đúng 10 câu hỏi phỏng vấn, áp dụng mô hình S.T.A.R nếu phù hợp.
2. Dựa vào JD để đánh giá Core Skills, Dựa vào CV để đào sâu kinh nghiệm.
3. Câu hỏi phải bằng tiếng Việt, rõ ràng.
4. **Trọng số theo category:** Phân bổ "max_score" cho từng câu hỏi sao cho tổng điểm 10 câu là đúng 100 điểm. Các kỹ năng quan trọng trong JD nên chiếm trọng số điểm cao hơn.
5. Cung cấp tiêu chí chấm điểm (scoring_criteria) chi tiết cho 3 mức: excellent (xuất sắc), good (tốt), poor (yếu).
6. Cung cấp các ý chính cần có (key_points) trong câu trả lời.

### OUTPUT FORMAT:
You MUST return ONLY a valid JSON object in this structure:
{
  "questions": [
    {
       "id": "1",
       "category": "Behavioral",
       "question": "Nội dung câu hỏi...",
       "intent": "Mục đích câu hỏi",
       "max_score": 10,
       "scoring_criteria": {
          "excellent": "Mô tả câu trả lời xuất sắc (8-10 điểm)",
          "good": "Mô tả câu trả lời tốt (5-7 điểm)",
          "poor": "Mô tả câu trả lời yếu (1-4 điểm)"
       },
       "key_points": ["Ý chính 1", "Ý chính 2"]
    }
  ]
}
`;
        try {
            const reply = await this.callGemini(prompt);
            const cleanJson = reply.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (e) {
            console.error('AI Generate Questions Error:', e?.message || e);
            return { questions: [], error: e?.message || 'Unknown AI error' };
        }
    }

    // Feature 4: Parse JD to JSON Competency
    async parseJDCompetencies(description: string): Promise<any> {
        const prompt = `
### TASK:
Phân tích mô tả công việc (JD) sau đây và trích xuất ra các yêu cầu năng lực.
Job Description: ${description}

### OUTPUT FORMAT:
You MUST return ONLY a valid JSON object in this structure:
{
  "skills": ["Kỹ năng 1", "Kỹ năng 2"],
  "experience": ["Kinh nghiệm 1", "Kinh nghiệm 2"],
  "attitude": ["Thái độ/Phẩm chất 1", "Thái độ/Phẩm chất 2"]
}
`;
        try {
            const reply = await this.callGemini(prompt);
            const cleanJson = reply.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanJson);
        } catch (e) {
            console.error('AI Parse JD Error:', e);
            return { skills: [], experience: [], attitude: [] };
        }
    }

    // --- HELPER: GET SENSITIVE TOOLS & PERMISSION DESCRIPTIONS ---
    private isSensitiveTool(toolName: string): boolean {
        const SENSITIVE_TOOLS = ['get_customer_360_profile', 'get_finance_and_debt_analytics', 'execute_smart_action'];
        return SENSITIVE_TOOLS.includes(toolName);
    }

    private getPermissionDescription(toolName: string, args: any): { title: string; description: string; scope: string } {
        if (toolName === 'get_customer_360_profile') {
            const name = args.customerName || args.query || (args.customerId ? `ID: ${args.customerId}` : 'Khách hàng');
            return {
                title: 'Yêu cầu quyền truy cập Dữ liệu Khách hàng 360°',
                description: `AI cần đọc toàn bộ lịch sử đơn hàng, dòng tiền và công nợ của ${name} để phân tích.`,
                scope: 'Đọc hồ sơ khách hàng, 10 đơn hàng gần nhất, công nợ và lịch sử chăm sóc CRM.'
            };
        }
        if (toolName === 'get_finance_and_debt_analytics') {
            const timeDesc = args.month && args.month > 0 ? `tháng ${args.month}/${args.year || new Date().getFullYear()}` : `năm ${args.year || new Date().getFullYear()}`;
            return {
                title: 'Yêu cầu quyền truy cập Báo cáo Tài chính & Sổ nợ',
                description: `AI cần truy xuất báo cáo doanh thu, chi phí, lợi nhuận và danh sách công nợ quá hạn ${timeDesc}.`,
                scope: 'Đọc sổ thu chi kế toán, tổng hợp công nợ khách hàng và phân tích biên lợi nhuận.'
            };
        }
        if (toolName === 'execute_smart_action') {
            return {
                title: 'Yêu cầu quyền Thực thi Hành động vào Hệ thống',
                description: `AI yêu cầu thực hiện hành động: ${args.actionType || 'Cập nhật dữ liệu'}`,
                scope: `Thực hiện ghi dữ liệu mới vào cơ sở dữ liệu: ${JSON.stringify(args.payload || {})}`
            };
        }
        return {
            title: 'Yêu cầu quyền truy cập dữ liệu',
            description: `AI cần quyền truy cập dữ liệu để thực thi công cụ ${toolName}`,
            scope: 'Đọc dữ liệu nội bộ ERP'
        };
    }

    private getToolStatusText(toolName: string, args: any): string {
        const toolMap: Record<string, string> = {
            'search_customer': `🔍 Đang tìm kiếm thông tin khách hàng "${args?.query || ''}"...`,
            'get_customer_360_profile': `📊 Đang tổng hợp hồ sơ 360°, đơn hàng & công nợ...`,
            'get_sales_order_360_profile': `📦 Đang truy xuất chi tiết đơn hàng "${args?.orderCodeOrId || args?.query || ''}"...`,
            'get_product_360_profile': `🏷️ Đang kiểm tra thông tin & tồn kho sản phẩm "${args?.skuOrName || args?.query || ''}"...`,
            'check_stock': `📦 Đang kiểm tra dữ liệu tồn kho...`,
            'get_finance_and_debt_analytics': `💰 Đang phân tích số liệu tài chính & công nợ...`,
            'check_mrp_status': `⚙️ Đang phân tích kế hoạch sản xuất MRP...`,
            'check_tasks': `📋 Đang kiểm tra danh sách công việc...`,
            'execute_smart_action': `⚡ Đang chuẩn bị thực thi hành động...`
        };
        return toolMap[toolName] || `Đang xử lý nghiệp vụ (${toolName})...`;
    }

    // --- DEEP ERP 360° TOOL HANDLERS ---
    async handleGetCustomer360Profile(args: any): Promise<any> {
        try {
            let customer: any = null;
            let searchKey = '';

            if (typeof args === 'number') {
                customer = await this.customersService.findOne(args);
            } else if (typeof args === 'string') {
                searchKey = args;
            } else if (args) {
                if (args.customerId) {
                    customer = await this.customersService.findOne(Number(args.customerId));
                }
                searchKey = args.query || args.customerName || args.name || args.keyword || '';
            }

            if (!customer && searchKey) {
                const list = await this.customersService.searchCustomersAdvanced(searchKey);
                if (list && list.length > 0) {
                    customer = await this.customersService.findOne(list[0].id);
                }
            }

            if (!customer) {
                return { error: `Không tìm thấy khách hàng khớp với thông tin "${searchKey || args?.customerId || ''}". Vui lòng kiểm tra lại tên hoặc mã khách hàng.` };
            }

            // 1. Get customer orders with payment amounts & items
            let orders: any[] = [];
            try {
                // Thử lấy qua customersService trước
                orders = await this.customersService.getOrders(customer.id);
            } catch (e) {
                orders = [];
            }

            // Nếu danh sách đơn rỗng, tìm trực tiếp qua Sales Order Repository (theo ID hoặc Tên khách)
            if (!orders || orders.length === 0) {
                try {
                    const directOrders = await this.salesService.orderRepo.find({
                        where: [
                            { customer_id: customer.id },
                            { customer: { id: customer.id } },
                            { customer_name: customer.name }
                        ],
                        relations: ['items', 'items.product'],
                        order: { order_date: 'DESC' }
                    });

                    orders = await Promise.all(directOrders.map(async (order: any) => {
                        let paid = 0;
                        try {
                            const payments = await this.salesService['transRepo'].find({
                                where: [
                                    { reference_code: order.order_code, type: 'INCOME' },
                                    { reference_code: order.order_code, reference_type: 'SALES' }
                                ]
                            });
                            paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
                        } catch (err) {
                            paid = Number(order.paid_amount || 0);
                        }
                        return {
                            ...order,
                            total_amount: Number(order.total_amount || 0),
                            paid_amount: paid
                        };
                    }));
                } catch (err) {}
            }

            // 2. Compute KPIs
            const validOrders = orders.filter(o => o.status !== 'CANCELLED' && o.status !== 'QUOTATION');
            const totalOrdersCount = validOrders.length;
            const totalLifetimeRevenue = validOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
            const totalPaidAmount = validOrders.reduce((sum, o) => sum + Number(o.paid_amount || 0), 0);
            const currentDebt = totalLifetimeRevenue - totalPaidAmount;

            // 3. Aggregate top purchased products
            const productStats: Record<string, { sku: string; name: string; quantity: number; totalSpent: number }> = {};
            for (const order of validOrders) {
                if (order.items && Array.isArray(order.items)) {
                    for (const item of order.items) {
                        const sku = item.product?.sku || item.sku || 'N/A';
                        const name = item.product?.name || item.product_name || 'Sản phẩm';
                        const qty = Number(item.quantity || 0);
                        const total = Number(item.total_price || (item.unit_price * qty) || 0);

                        if (!productStats[sku]) {
                            productStats[sku] = { sku, name, quantity: 0, totalSpent: 0 };
                        }
                        productStats[sku].quantity += qty;
                        productStats[sku].totalSpent += total;
                    }
                }
            }
            const topProducts = Object.values(productStats).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 5);

            // 4. Get recent CRM notes / comments
            let recentComments: any[] = [];
            try {
                recentComments = await this.customersService.getComments(customer.id);
            } catch (e) {}

            return {
                customer_profile: {
                    id: customer.id,
                    code: customer.code,
                    name: customer.name,
                    phone: customer.phone || 'Chưa có',
                    email: customer.email || 'Chưa có',
                    address: customer.address || 'Chưa có',
                    tax_code: customer.tax_code || 'N/A',
                    type: customer.type,
                    lead_status: customer.lead_status,
                    credit_limit: customer.credit_limit || 0,
                    assigned_to: customer.assigned_to?.full_name || 'Chưa gán',
                    contacts: (customer.contacts || []).map((c: any) => ({ name: c.name, phone: c.phone, role: c.role, email: c.email }))
                },
                financial_and_sales_kpis: {
                    total_orders: totalOrdersCount,
                    total_lifetime_revenue: totalLifetimeRevenue,
                    total_paid: totalPaidAmount,
                    current_debt: currentDebt,
                    average_order_value: totalOrdersCount > 0 ? Math.round(totalLifetimeRevenue / totalOrdersCount) : 0,
                    last_order_date: orders.length > 0 ? (orders[0].order_date || orders[0].created_at) : null
                },
                recent_orders_sample: orders.slice(0, 8).map(o => ({
                    order_code: o.order_code,
                    date: o.order_date || o.created_at,
                    total_amount: Number(o.total_amount || 0),
                    paid_amount: Number(o.paid_amount || 0),
                    remaining_debt: Number(o.total_amount || 0) - Number(o.paid_amount || 0),
                    status: o.status,
                    payment_status: o.payment_status,
                    delivery_date: o.delivery_date
                })),
                top_purchased_products: topProducts,
                recent_crm_notes: recentComments.slice(0, 5).map(c => ({
                    author: c.author_name || c.user_name || 'Nhân viên',
                    content: c.content,
                    created_at: c.created_at,
                    source: c.source
                }))
            };
        } catch (e) {
            return { error: `Lỗi tổng hợp hồ sơ 360: ${e.message}` };
        }
    }

    async handleGetSalesOrder360(orderCodeOrId: string | number): Promise<any> {
        try {
            const order = await this.salesService.findOne(orderCodeOrId);
            if (!order) return { error: `Không tìm thấy đơn hàng "${orderCodeOrId}".` };

            return {
                order_code: order.order_code,
                customer_name: order.customer?.name,
                customer_phone: order.customer?.phone,
                order_date: order.order_date,
                delivery_date: order.delivery_date,
                status: order.status,
                payment_status: order.payment_status,
                total_amount: Number(order.total_amount || 0),
                paid_amount: Number(order.paid_amount || 0),
                remaining_debt: Number(order.total_amount || 0) - Number(order.paid_amount || 0),
                items: (order.items || []).map((item: any) => ({
                    sku: item.product?.sku || item.sku,
                    name: item.product?.name || item.product_name,
                    quantity: Number(item.quantity || 0),
                    unit_price: Number(item.unit_price || 0),
                    total_price: Number(item.total_price || 0),
                    booked_quantity: Number(item.booked_quantity || 0)
                })),
                assigned_to: order.assigned_to?.full_name || 'N/A',
                note: order.note
            };
        } catch (e) {
            return { error: `Lỗi đọc chi tiết đơn hàng: ${e.message}` };
        }
    }

    async handleGetProduct360(skuOrName: string): Promise<any> {
        try {
            const products = await this.productsService.searchProducts(skuOrName);
            if (!products || products.length === 0) return { error: `Không tìm thấy sản phẩm khớp với "${skuOrName}".` };
            const p = products[0];
            return {
                id: p.id,
                sku: p.sku,
                name: p.name,
                product_type: p.product_type,
                unit: p.unit,
                base_price: Number(p.base_price || 0),
                cost_price: Number(p.cost_price || 0),
                quantity_in_stock: Number(p.quantity_in_stock || 0),
                booking_stock: Number(p.booking_stock || 0),
                approved_booking_stock: Number(p.approved_booking_stock || 0),
                is_active: p.is_active
            };
        } catch (e) {
            return { error: `Lỗi đọc thông tin sản phẩm: ${e.message}` };
        }
    }

    async handleGetFinanceDebtAnalytics(args: any): Promise<any> {
        try {
            const y = args.year || new Date().getFullYear();
            const m = args.month !== undefined ? args.month : new Date().getMonth() + 1;

            let summary: any = null;
            if (m === 0) {
                let totalIncome = 0; let totalExpense = 0; let totalProfit = 0;
                for (let month = 1; month <= 12; month++) {
                    const dateStr = `${y}-${String(month).padStart(2, '0')}`;
                    try {
                        const rep = await this.financeService.getFinancialReport(dateStr);
                        totalIncome += rep.summary.income || 0;
                        totalExpense += rep.summary.expense || 0;
                        totalProfit += rep.summary.profit || 0;
                    } catch (e) {}
                }
                summary = { year: y, totalIncome, totalExpense, totalProfit };
            } else {
                const dateStr = `${y}-${String(m).padStart(2, '0')}`;
                try {
                    const rep = await this.financeService.getFinancialReport(dateStr);
                    summary = { month: m, year: y, income: rep.summary.income, expense: rep.summary.expense, profit: rep.summary.profit };
                } catch (e) {
                    summary = { month: m, year: y, error: "Chưa có dữ liệu" };
                }
            }

            const unpaidOrders = await this.salesService.findOrdersByFilters({
                year: y,
                month: m > 0 ? m : undefined,
                paymentStatus: 'UNPAID'
            });

            const overdueSummary = unpaidOrders.slice(0, 10).map(o => ({
                order_code: o.order_code,
                customer_name: o.customer?.name,
                customer_phone: o.customer?.phone,
                total_amount: Number(o.total_amount || 0),
                paid_amount: Number(o.paid_amount || 0),
                remaining_debt: Number(o.total_amount || 0) - Number(o.paid_amount || 0),
                order_date: o.order_date,
                delivery_date: o.delivery_date
            }));

            return {
                financial_summary: summary,
                overdue_orders_sample: overdueSummary,
                total_unpaid_orders_count: unpaidOrders.length
            };
        } catch (e) {
            return { error: `Lỗi phân tích tài chính & công nợ: ${e.message}` };
        }
    }

    async handleAiToolCall(functionName: string, args: any, userId?: string): Promise<any> {
        try {
            if (functionName === 'search_customer') {
                const customers = await this.customersService.searchCustomersAdvanced(args.query);
                return customers.slice(0, 5).map(c => ({
                    id: c.id,
                    code: c.code,
                    name: c.name,
                    phone: c.phone,
                    email: c.email,
                    type: c.type,
                    lead_status: c.lead_status
                }));
            }

            if (functionName === 'get_customer_360_profile') {
                return await this.handleGetCustomer360Profile(args);
            }

            if (functionName === 'get_sales_order_360_profile') {
                return await this.handleGetSalesOrder360(args.orderCodeOrId);
            }

            if (functionName === 'get_product_360_profile') {
                return await this.handleGetProduct360(args.skuOrName);
            }

            if (functionName === 'check_stock') {
                const products = await this.productsService.searchProducts(args.query);
                return products.map(p => ({ name: p.name, sku: p.sku, stock: p.quantity_in_stock, unit: p.unit }));
            }

            if (functionName === 'get_finance_and_debt_analytics') {
                return await this.handleGetFinanceDebtAnalytics(args);
            }

            if (functionName === 'check_mrp_status') {
                try {
                    const sugg = await this.planningService.getSuggestion();
                    return sugg.slice(0, 8).map(o => ({ order: o.order_code, customer: o.customer?.name, delivery_date: o.delivery_date }));
                } catch(e) {
                    return { error: e.message };
                }
            }

            if (functionName === 'check_tasks') {
                const all = await this.tasksService.findAll();
                return all.filter((t: any) =>
                    !args.query || t.title?.toLowerCase().includes(args.query.toLowerCase()) ||
                    t.assignee?.full_name?.toLowerCase().includes(args.query.toLowerCase())
                ).slice(0, 8).map(t => ({ title: t.title, assignee: t.assignee?.full_name, status: t.status, due: t.due_date }));
            }

            if (functionName === 'execute_smart_action') {
                if (args.actionType === 'CREATE_TASK') {
                    let assigneeId = null;
                    if (args.payload?.assignee_name) {
                        const allUsers = await this.usersService.getAllUsers();
                        const user = allUsers.find(u => u.full_name?.toLowerCase().includes(args.payload.assignee_name.toLowerCase()));
                        if (user) assigneeId = user.id;
                    }
                    const newTask = await this.tasksService.create({
                        title: args.payload.title,
                        description: args.payload.description || 'Tạo bởi ERP4U AI Assistant',
                        status: 'TODO',
                        priority: args.payload.priority || 'MEDIUM',
                        assignee_id: assigneeId,
                        due_date: args.payload.due_date || new Date(Date.now() + 86400000)
                    });
                    return { success: true, message: `Đã tạo công việc thành công (ID: ${newTask.id})` };
                }
                if (args.actionType === 'CREATE_LEAD') {
                    const code = `LEAD-${Date.now().toString().slice(-6)}`;
                    await this.customersService.create({
                        code,
                        name: args.payload.name,
                        phone: args.payload.phone,
                        type: 'LEAD',
                        lead_status: 'NEW'
                    });
                    return { success: true, message: `Đã tạo Lead mới: ${args.payload.name}` };
                }
            }

            return { error: `Tool ${functionName} not found` };
        } catch (e) {
            return { error: e.message };
        }
    }

    // --- AGENTIC REACT STREAMING & PERMISSION-GATED CHAT ---
    async handleChatStream(
        userId: string,
        message: string,
        contextUrl: string,
        activeContext: any,
        approvedPermission: any,
        onChunk: (text: string) => void,
        onStatus?: (status: string) => void,
        onPermissionRequest?: (permission: any) => void
    ) {
        let apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) {
            onChunk("AI Service is not configured (Missing GEMINI_API_KEY).");
            return;
        }
        apiKey = apiKey.trim();

        // 1. Save user message to DB (if not just approving a permission)
        if (message && message.trim() !== '') {
            const userMsg = this.aiMessageRepo.create({ user_id: userId, role: 'user', content: message });
            await this.aiMessageRepo.save(userMsg);
        }

        // 2. Load recent history (last 10 messages)
        const history = await this.aiMessageRepo.find({ where: { user_id: userId }, order: { id: 'ASC' }, take: 10 });

        const validHistory = history.filter(h => h.content && h.content.trim() !== '');
        const contents: any[] = [];
        let lastRole = '';

        for (const h of validHistory) {
            const role = h.role === 'assistant' || h.role === 'model' ? 'model' : 'user';
            if (role === lastRole && contents.length > 0) {
                contents[contents.length - 1].parts[0].text += '\n\n' + h.content;
            } else {
                contents.push({
                    role: role,
                    parts: [{ text: h.content }]
                });
                lastRole = role;
            }
        }

        // Contextual awareness prompt
        let activeEntityContext = '';
        if (activeContext) {
            activeEntityContext = `\nACTIVE SCREEN CONTEXT: User is currently on page "${contextUrl}". Active entity data: ${JSON.stringify(activeContext)}`;
        }

        const now = new Date();
        const knowledgeContext = this.aiKnowledgeService.getKnowledgeContext();

        const systemInstruction = {
            parts: [{ text: `You are ERP4UBot, an expert Enterprise ERP AI Copilot & Business Analyst for ERP4U in Vietnam.
Current date: ${now.toISOString().split('T')[0]} (Năm: ${now.getFullYear()}, Tháng: ${now.getMonth() + 1})
Current Page URL: ${contextUrl || 'Unknown'}
${activeEntityContext}

${knowledgeContext}

CRITICAL RULES & OPERATIONAL PRINCIPLES:
1. ENTITY RECOGNITION (CRUCIAL):
   - Any phrase with "Trường...", "Mầm non...", "Công ty...", "TNHH...", "Doanh nghiệp...", "Khách hàng...", "Anh/Chị..." is ALWAYS A CUSTOMER (Khách hàng).
   - NEVER treat schools, companies, or partners as physical products!
   - When asked to analyze or summarize a school, company, or customer, you MUST call \`get_customer_360_profile\` with { query: "name" }.

2. ALWAYS EXECUTE TOOLS IMMEDIATELY. DO NOT ASK CONFIRMATION IN TEXT.
   - When the user asks for ANY customer summary, order details, inventory status, financial report, or task list (e.g. "tổng hợp thông tin trường mầm non Trí Đức plus", "phân tích khách hàng...", "tồn kho...", "báo cáo tài chính..."), you MUST IMMEDIATELY INVOKE the appropriate tool function call.
   - NEVER generate conversational text asking "Bạn có muốn tôi tìm kiếm không?", "Bạn có đồng ý để tôi tra cứu không?", "Bạn có cần ERP4UBot hỗ trợ gì không?".
   - NEVER hesitate or ask permission in text. Just directly call the tool!

3. UNDERSTANDING USER CONFIRMATIONS / FOLLOW-UP REPLIES:
   - When the user says "có", "yes", "ok", "đồng ý", "làm đi", "tiếp tục", "phân tích đi":
     Look at the previous conversation history, extract what customer/order/analysis was mentioned, and IMMEDIATELY INVOKE the tool for that entity!

4. TOOL SELECTION MAP:
   - To summarize/analyze a Customer: Call \`get_customer_360_profile\` with { query: "customer name" } or { customerId: number }.
   - To inspect a Sales Order: Call \`get_sales_order_360_profile\` with { orderCodeOrId: "SO..." }.
   - To inspect Products / Stock: Call \`get_product_360_profile\` or \`check_stock\` ONLY for physical items (nệm, gối, ga, vải, chỉ, v.v.).
   - To analyze Finances / Debt: Call \`get_finance_and_debt_analytics\` with { month: number, year: number }.
   - To check Production / MRP: Call \`check_mrp_status\`.
   - To check Tasks / Assignments: Call \`check_tasks\`.

5. EXECUTIVE REPORT FORMATTING:
   - Once tool data is returned, structure your final Vietnamese answer with professional Markdown:
     - 📊 **Tóm Tắt Tổng Quan (Executive Summary)**
     - 📈 **Khung Chỉ Số Chính (Key KPIs)**: Doanh thu LTV, Công nợ hiện tại, Số đơn hàng, Trạng thái
     - 📋 **Bảng Biểu Chi Tiết**: Dùng markdown tables để hiển thị đơn hàng/sản phẩm với số tiền format VND (ví dụ: 15.000.000 đ)
     - 💡 **Nhận Định & Khuyến Nghị Tiếp Theo (Actionable Insights)**: Cảnh báo nợ quá hạn, đề xuất chăm sóc, gợi ý cross-sell/up-sell.
6. Base all answers strictly on actual retrieved ERP data.` }]
        };

        const tools = [{
            functionDeclarations: [
                {
                    name: "get_customer_360_profile",
                    description: "Lấy toàn bộ hồ sơ 360 độ của khách hàng (Doanh thu trọn đời LTV, công nợ, lịch sử đơn hàng, top sản phẩm mua nhiều nhất, ghi chú CRM). Hãy gọi tool này ngay khi người dùng yêu cầu tổng hợp thông tin hoặc phân tích trường mầm non, công ty, khách hàng.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            query: { type: "STRING", description: "Tên hoặc từ khóa tìm kiếm khách hàng (ví dụ: 'Trường mầm non Trí Đức Plus', 'Đức Trí')" },
                            customerId: { type: "INTEGER", description: "ID của khách hàng trong hệ thống (nếu đã biết)" }
                        }
                    }
                },
                {
                    name: "search_customer",
                    description: "Tìm kiếm nhanh danh sách khách hàng theo tên, số điện thoại, hoặc mã khách hàng",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            query: { type: "STRING", description: "Tên, số điện thoại hoặc mã khách hàng cần tìm" }
                        },
                        required: ["query"]
                    }
                },
                {
                    name: "get_sales_order_360_profile",
                    description: "Lấy chi tiết đơn hàng (mã đơn, khách hàng, ngày giao, danh sách sản phẩm, giá bán, thanh toán, công nợ đơn)",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            orderCodeOrId: { type: "STRING", description: "Mã đơn hàng SO hoặc ID đơn" }
                        },
                        required: ["orderCodeOrId"]
                    }
                },
                {
                    name: "get_product_360_profile",
                    description: "Lấy thông tin chi tiết sản phẩm vật tư, thành phẩm, hàng hóa (tồn kho, giá vốn, giá bán, quy cách). CHỈ DÙNG CHO SẢN PHẨM/VẬT TƯ, KHÔNG DÙNG CHO KHÁCH HÀNG HAY TRƯỜNG HỌC.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            skuOrName: { type: "STRING", description: "Mã SKU hoặc tên sản phẩm" }
                        },
                        required: ["skuOrName"]
                    }
                },
                {
                    name: "check_stock",
                    description: "Kiểm tra tồn kho nhanh sản phẩm theo từ khóa",
                    parameters: {
                        type: "OBJECT",
                        properties: { query: { type: "STRING", description: "Tên hoặc mã SKU" } },
                        required: ["query"]
                    }
                },
                {
                    name: "get_finance_and_debt_analytics",
                    description: "Phân tích tài chính, doanh thu, chi phí, lợi nhuận và danh sách nợ quá hạn theo tháng hoặc cả năm (tháng=0)",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            month: { type: "INTEGER", description: "Tháng (1-12, hoặc 0 nếu cả năm)" },
                            year: { type: "INTEGER", description: "Năm cần phân tích" }
                        },
                        required: ["year"]
                    }
                },
                {
                    name: "check_mrp_status",
                    description: "Kiểm tra kế hoạch sản xuất MRP, các đơn hàng cần lập kế hoạch sản xuất",
                    parameters: { type: "OBJECT", properties: {} }
                },
                {
                    name: "check_tasks",
                    description: "Kiểm tra danh sách công việc và phân công nhiệm vụ",
                    parameters: {
                        type: "OBJECT",
                        properties: { query: { type: "STRING", description: "Từ khóa công việc hoặc tên nhân viên" } }
                    }
                },
                {
                    name: "execute_smart_action",
                    description: "Thực thi các hành động ghi dữ liệu vào hệ thống (Tạo task, tạo lead mới, thêm ghi chú)",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            actionType: { type: "STRING", enum: ["CREATE_TASK", "CREATE_LEAD"], description: "Loại hành động" },
                            payload: { type: "OBJECT", description: "Tham số chi tiết của hành động" }
                        },
                        required: ["actionType", "payload"]
                    }
                }
            ]
        }];

        let modelName = 'models/gemini-1.5-flash';
        try {
            modelName = await this.getBestModel(apiKey);
        } catch (e) {}

        // --- DIRECT EXECUTION OF PRE-APPROVED PERMISSIONS ---
        if (approvedPermission && approvedPermission.toolName) {
            const funcName = approvedPermission.toolName;
            const args = approvedPermission.args || {};

            if (onStatus) {
                onStatus(this.getToolStatusText(funcName, args));
            }

            const toolResult = await this.handleAiToolCall(funcName, args, userId);

            // Ensure last user message exists
            if (contents.length === 0 || contents[contents.length - 1].role === 'model') {
                contents.push({ role: 'user', parts: [{ text: message || `Phân tích dữ liệu 360 cho ${args?.query || args?.customerName || funcName}` }] });
            }

            // Append model's tool call & function response directly
            contents.push({
                role: 'model',
                parts: [{ functionCall: { name: funcName, args: args } }]
            });

            contents.push({
                role: 'function',
                parts: [{
                    functionResponse: {
                        name: funcName,
                        response: { result: toolResult }
                    }
                }]
            });
        } else {
            // Ensure user message is at the end of contents
            if (contents.length === 0 || contents[contents.length - 1].role === 'model') {
                contents.push({ role: 'user', parts: [{ text: message || 'Tiếp tục xử lý' }] });
            }
        }

        // --- AGENTIC REACT LOOP (Max 5 iterations) ---
        const MAX_ITERATIONS = 5;
        let iteration = 0;
        let finalResponseText = "";

        while (iteration < MAX_ITERATIONS) {
            iteration++;
            if (onStatus) onStatus(iteration === 1 ? 'Đang phân tích yêu cầu...' : 'Đang suy luận bước tiếp theo...');

            let generateRes: any;
            try {
                generateRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemInstruction,
                        contents,
                        tools,
                        toolConfig: {
                            functionCallingConfig: {
                                mode: 'AUTO'
                            }
                        }
                    }),
                    signal: AbortSignal.timeout(45000)
                });
            } catch (e) {
                onChunk("Lỗi kết nối AI (Network timeout).");
                return;
            }

            const data = await generateRes.json();
            if (data.error) {
                onChunk(`Lỗi AI API: ${data.error.message}`);
                return;
            }

            const candidate = data.candidates?.[0];
            if (!candidate) {
                onChunk("AI không trả về kết quả.");
                return;
            }

            const functionCall = candidate.content?.parts?.find((p: any) => p.functionCall)?.functionCall;

            if (functionCall) {
                const funcName = functionCall.name;
                const args = functionCall.args || {};

                // Check Sensitive Tool Permissions (Human-in-the-loop)
                const isAffirmative = /^(có|yes|ok|đồng ý|uh|được|làm đi|phân tích đi|tiếp tục|xác nhận|chấp nhận)$/i.test(message?.trim() || '');
                const isApproved = (approvedPermission && (
                    approvedPermission.approved === true ||
                    approvedPermission.toolName === funcName
                )) || isAffirmative;

                if (this.isSensitiveTool(funcName) && !isApproved) {
                    const permInfo = this.getPermissionDescription(funcName, args);
                    if (onPermissionRequest) {
                        onPermissionRequest({
                            requestId: `perm_${Date.now()}`,
                            toolName: funcName,
                            args: args,
                            title: permInfo.title,
                            description: permInfo.description,
                            scope: permInfo.scope
                        });
                    }
                    // Wait for user approval, finish turn
                    return;
                }

                // User approved or Safe tool -> Execute
                if (onStatus) {
                    onStatus(this.getToolStatusText(funcName, args));
                }

                const toolResult = await this.handleAiToolCall(funcName, args, userId);

                // Append model's tool call & function response to contents
                contents.push({
                    role: 'model',
                    parts: [{ functionCall }]
                });

                contents.push({
                    role: 'function',
                    parts: [{
                        functionResponse: {
                            name: funcName,
                            response: { result: toolResult }
                        }
                    }]
                });

                // Continue loop to let Gemini inspect the result
                continue;
            } else {
                // Final answer reached!
                const text = candidate.content?.parts?.map((p: any) => p.text).filter(Boolean).join('\n') || "";
                if (text) {
                    finalResponseText = text;
                    onChunk(text);
                } else {
                    const reason = candidate.finishReason || 'Unknown';
                    onChunk(`[Hệ thống AI không thể hoàn thành yêu cầu. Lý do: ${reason}]`);
                }
                break;
            }
        }

        // Save AI response to DB
        if (finalResponseText) {
            const aiMsg = this.aiMessageRepo.create({ user_id: userId, role: 'model', content: finalResponseText });
            await this.aiMessageRepo.save(aiMsg);
        }
    }
}

