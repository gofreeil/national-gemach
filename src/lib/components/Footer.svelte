<script lang="ts">
    const year = new Date().getFullYear();
</script>

<footer class="bg-[#0d1117] border-t border-white/10 py-4 mt-6">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex flex-col md:flex-row items-center justify-between gap-4">

            <!-- Brand -->
            <a
                href="https://www.melecshop.com/"
                target="_blank"
                rel="noopener noreferrer"
                class="flex items-center gap-3 hover:opacity-80 transition-opacity"
                aria-label="יוצאים לחירות (נפתח בחלון חדש)"
            >
                <div class="flex flex-col text-right leading-tight">
                    <p class="text-yellow-400 font-black text-sm">יוצאים לחירות</p>
                    <p class="text-gray-300 text-xs">לכלל פעילות התנועה החברתית</p>
                </div>
            </a>

            <!-- Links -->
            <nav class="flex items-center gap-4 text-sm text-gray-300 font-bold" aria-label="ניווט תחתון">
                <a href="/legal" class="hover:text-white transition-colors">תנאי שימוש</a>
                <span class="text-gray-600" aria-hidden="true">|</span>
                <a href="mailto:freedomhasbegun@gmail.com" class="hover:text-white transition-colors">צור קשר</a>
                <span class="text-gray-600" aria-hidden="true">|</span>
                <a href="/about" class="hover:text-white transition-colors">אודות</a>
            </nav>

            <!-- Copyright -->
            <p class="text-gray-400 text-sm font-bold">
                &copy; {year} הגמח הארצי — כל הזכויות שמורות
            </p>
        </div>
    </div>
</footer>
