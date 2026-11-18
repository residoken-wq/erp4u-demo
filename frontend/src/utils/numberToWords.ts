export function numberToWords(num: number): string {
    if (num === 0) return "không đồng";

    const ones = ["", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    const tens = ["", "mười", "hai mươi", "ba mươi", "bốn mươi", "năm mươi", "sáu mươi", "bảy mươi", "tám mươi", "chín mươi"];
    const blocks = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];

    let word = "";
    let blockCount = 0;

    let n = Math.floor(Math.abs(num)); // Handle absolute, no decimals for simple words

    if (n === 0) return "Không đồng";

    function readBlock(n: number, full: boolean): string {
        let res = "";
        let h = Math.floor(n / 100);
        let t = Math.floor((n % 100) / 10);
        let o = n % 10;

        if (full) {
            res += ones[h] + " trăm ";
        } else if (h > 0) {
            res += ones[h] + " trăm ";
        }

        if (t === 0) {
            if (o > 0 && h > 0) res += "lẻ ";
            if (o > 0) res += ones[o];
        } else if (t === 1) {
            res += "mười ";
            if (o === 5) res += "lăm";
            else if (o > 0) res += ones[o];
        } else {
            res += tens[t] + " ";
            if (o === 1) res += "mốt";
            else if (o === 5) res += "lăm";
            else if (o > 0) res += ones[o];
        }

        return res.trim();
    }

    while (n > 0) {
        let block = n % 1000;
        if (block > 0) {
            let fullStr = n >= 1000 && n % 1000 < 100;
            let blockStr = readBlock(block, fullStr);
            // Better simple rule:
            blockStr = readBlock(block, n > 1000 && blockCount > 0 && (n - block) > 0);
            word = blockStr + " " + blocks[blockCount] + " " + word;
        } else if (n > 0 && blocks[blockCount] === "tỷ") {
            word = "tỷ " + word;
        }
        n = Math.floor(n / 1000);
        blockCount++;
    }

    word = word.trim() + " đồng";
    word = word.replace(/ {2,}/g, " ");

    return word.charAt(0).toUpperCase() + word.slice(1);
}
