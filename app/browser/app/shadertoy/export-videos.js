const { spawn } = require('child_process');
const { join } = require('path');
const rimraf = require('rimraf-promise');

const processes = [];

function spawnFFMPEG(args) {
	return new Promise((resolve, reject) => {
		args.push('-loglevel', 'error');
		const ffmpeg = spawn('ffmpeg', args);
		processes.push(ffmpeg);

		ffmpeg.stdout.on('data', (data) => {
			console.log(data.toString());
		});

		ffmpeg.stderr.on('data', (data) => {
			console.error(data.toString());
		});

		ffmpeg.on('close', (code, signal) => {
			const index = processes.indexOf(ffmpeg);
			processes.splice(index, 1);

			if (code)
				return reject(new Error('ffmpeg exited with code ' + code + '.'));
			else if (signal)
				return reject(new Error('ffmpeg was stopped by signal ' + signal + '.'));
			else
				return resolve();
		});
	});
}

export function exportGIF(options) {
	const filters = 'fps=' + options.fps;
	const frameCount = options.duration * options.fps;
	const inputFilename = join(options.directory, options.prefix + '%0' + options.padding + 'd.png');
	const paletteFilename = join(options.directory, options.prefix + '-palette.png');
	return spawnFFMPEG([
		'-start_number',
		'0',
		'-i',
		inputFilename,
		'-vframes',
		frameCount,
		'-vf',
		filters + ',palettegen',
		'-y',
		paletteFilename,
	])
	.then(() => {
		return spawnFFMPEG([
			'-start_number',
			'0',
			'-i',
			inputFilename,
			'-i',
			paletteFilename,
			'-lavfi',
			filters + ' [x]; [x][1:v] paletteuse',
			'-vframes',
			frameCount,
			'-y',
			join(options.directory, options.prefix + '.gif'),
		]);
	})
	.then(() => {
		return rimraf(paletteFilename);
	});
}

export function exportMP4(options) {
	const frameCount = options.duration * options.fps;
	return spawnFFMPEG([
		'-r',
		options.fps,
		'-f',
		'image2',
		'-s',
		options.width + 'x' + options.height,
		'-start_number',
		'0',
		'-i',
		join(options.directory, options.prefix + '%0' + options.padding + 'd.png'),
		'-vframes',
		frameCount,
		'-vcodec',
		'libx264',
		'-crf',
		options.crf,
		'-pix_fmt',
		'yuv420p',
		join(options.directory, options.prefix + '.mp4'),
	]);
}

export function stop() {
	processes.forEach(ffmpeg => ffmpeg.kill());
}
