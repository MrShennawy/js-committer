import chalk from "chalk";

export default class DrawsBoxes {
    minWidth = Math.min(60, (process.stdout.columns - 6));

    stripEscapeSequences(text) {
        text = text.replace(/\x1b[^m]*m/g, '');
        return text.replace(/<(?:(?:[fb]g|options)=[a-z,;]+)+>(.*?)<\/>/i, '$1');
    }

    pad(text, length) {
        let rightPadding = ' '.repeat(Math.max(0, length - this.strLen(this.stripEscapeSequences(text))));
        return `${text}${rightPadding}`;
    }

    longest(lines, padding = 0) {
        let lengths = [this.minWidth];
        lines.forEach(line => lengths.push(this.strLen(this.stripEscapeSequences(line)) + padding))
        return Math.max(...lengths);
    }

    box({title, body, footer = '', color = 'gray', info = '', placeholder = '', hint = ''}) {
        let lineColor = (placeholder && !body) ? 'dim' : 'white';
        body = (body !== '') ? body : placeholder;
        let bodyLines = body.split('\n');
        let footerLines = footer.split('\n').filter(line => line);
        let width = this.longest(
            bodyLines.concat(footerLines).concat(title)
        );
        // console.log(this.stripEscapeSequences(title).length)
        let titleLength = this.strLen(this.stripEscapeSequences(title));

        let titleLabel = titleLength > 0 ? ` ${chalk.cyan(title)} ` : '';

        let topBorder = '─'.repeat(width - titleLength + (titleLength > 0 ? 0 : 2));
        let message = '\n';
        message += (`${chalk[color](' ┌')}${titleLabel}${chalk[color](topBorder+'┐')} \n`);

        bodyLines.forEach(line => {
            message += (`${chalk[color](' │')} ${chalk[lineColor](this.pad(line, width))} ${chalk[color]('│')} \n`);
        });

        if (footerLines.length) {
            message += (chalk[color](' ├'+'─'.repeat(width + 2)+'┤'));

            footerLines.forEach(line => {
                message += (`${chalk[color](' │')} ${this.pad(line, width)} ${chalk[color]('│')} \n`);
            });
        }

        message += (chalk[color](' └'+'─'.repeat(
            info ? (width - this.strLen(this.stripEscapeSequences(info))) : (width + 2)
        )+(info ? ` ${info} ` : '')+'┘'));

        if (hint) message += chalk.gray(`\n  ${hint}`);

        return message;
    }

    strLen(str) {
        var l = str.length;
        var c = '';
        var length = 0;
        for (var i = 0; i < l; i++) {
            c = str.charCodeAt(i);
            if (0x0000 <= c && c <= 0x0019) {
                length += 0;
            } else if (0x0020 <= c && c <= 0x1FFF) {
                length += 1;
            } else if (0x2000 <= c && c <= 0xFF60) {
                length += 2;
            } else if (0xFF61 <= c && c <= 0xFF9F) {
                length += 1;
            } else if (0xFFA0 <= c) {
                length += 2;
            }
        }
        return length;
    }

}